const SPREADSHEET_ID = "12wQPBrgcbZMPm0pU5dkomdmEapnvUF7gTRVGQ7nL7ZI";

const USERS_SHEET = "Laduma Users";
const BRANCH_SHEET = "Branches";
const REGION_SHEET = "Regions";


function doGet() {
  return HtmlService
    .createHtmlOutputFromFile("Index")
    .setTitle("Laduma – Pending Credit Note Management");
}

/* =========================================
   LOAD ADMIN ENTRY HTML
   ========================================= */

function getAdminEntryHtml() {

  return HtmlService
    .createHtmlOutputFromFile("AdminEntry")
    .getContent();

}
/* =========================================================
   OPEN SPREADSHEET
========================================================= */

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}


/* =========================================================
   CREATE SUPPORT SHEET IF REQUIRED
========================================================= */

function ensureUsersSheet() {

  const ss = getSpreadsheet();

  let sheet = ss.getSheetByName(USERS_SHEET);

  if (!sheet) {

    sheet = ss.insertSheet(USERS_SHEET);

    sheet.getRange(1, 1, 1, 8).setValues([[
      "User ID",
      "User Name",
      "Password Hash",
      "User Type",
      "Region",
      "Branch ID",
      "Branch Name",
      "Status"
    ]]);

    sheet.getRange(1, 1, 1, 8)
      .setFontWeight("bold");

    sheet.setFrozenRows(1);
  }

  return sheet;
}


/* =========================================================
   GET BRANCHES AND REGIONS
========================================================= */

function getBranchesAndRegions() {

  const ss = getSpreadsheet();

  const branchSheet = ss.getSheetByName(BRANCH_SHEET);

  if (!branchSheet) {
    throw new Error(
      'The sheet "' + BRANCH_SHEET + '" was not found.'
    );
  }

  const values = branchSheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const result = [];

  for (let i = 1; i < values.length; i++) {

    const branchId = String(values[i][0] || "").trim();
    const branchName = String(values[i][1] || "").trim();
    const region = String(values[i][2] || "").trim();

    if (branchName) {

      result.push({
        branchId: branchId,
        branchName: branchName,
        region: region
      });
    }
  }

  return result;
}

/* =========================================================
   PASSWORD HASH
========================================================= */

function hashPassword(password) {

  const raw = String(password || "");

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    raw,
    Utilities.Charset.UTF_8
  );

  return digest
    .map(function(byte) {

      const value = byte < 0 ? byte + 256 : byte;

      return ("0" + value.toString(16)).slice(-2);

    })
    .join("");
}


/* =========================================================
   REGISTER USER
========================================================= */

function registerUser(data) {

  ensureUsersSheet();

  if (!data) {
    throw new Error("Registration information is missing.");
  }

  const userName = String(data.userName || "").trim();
  const userId = String(data.userId || "").trim();
  const password = String(data.password || "");
  const confirmPassword = String(data.confirmPassword || "");

  const userType = String(data.userType || "ADMIN")
    .trim()
    .toUpperCase();

  const region = String(data.region || "").trim();
  const branchId = String(data.branchId || "").trim();
  const branchName = String(data.branchName || "").trim();


  // BASIC VALIDATION

  if (!userName) {
    throw new Error("Please enter User Name.");
  }

  if (!userId) {
    throw new Error("Please enter User ID.");
  }

  if (!password) {
    throw new Error("Please enter Password.");
  }

  if (password.length < 4) {
    throw new Error("Password must contain at least 4 characters.");
  }

  if (password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }


  // VALID USER TYPES

  const validUserTypes = [
    "ADMIN",
    "TEAM LEADER",
    "ACCOUNTS"
  ];

  if (validUserTypes.indexOf(userType) === -1) {
    throw new Error("Invalid User Type.");
  }


  // ADMIN REQUIRES REGION AND BRANCH

  if (userType === "ADMIN") {

    if (!region) {
      throw new Error("Please select Region.");
    }

    if (!branchId || !branchName) {
      throw new Error("Please select Branch.");
    }
  }


  // TEAM LEADER REQUIRES REGION

  if (userType === "TEAM LEADER") {

    if (!region) {
      throw new Error("Please select Region.");
    }
  }


  // ACCOUNTS DOES NOT REQUIRE REGION OR BRANCH

  if (userType === "ACCOUNTS") {
    // No region or branch required.
  }


  const sheet = ensureUsersSheet();

  const lastRow = sheet.getLastRow();


  // CHECK DUPLICATE USER ID

  if (lastRow >= 2) {

    const existingIds =
      sheet
        .getRange(2, 1, lastRow - 1, 1)
        .getValues();

    for (let i = 0; i < existingIds.length; i++) {

      const existingId =
        String(existingIds[i][0] || "")
          .trim()
          .toLowerCase();

      if (existingId === userId.toLowerCase()) {

        throw new Error(
          "This User ID already exists."
        );
      }
    }
  }


  const status = "ACTIVE";

  const passwordHash = hashPassword(password);


  // SAVE USER

  sheet.appendRow([
    userId,
    userName,
    passwordHash,
    userType,
    region,
    branchId,
    branchName,
    status
  ]);


  return {
    success: true,
    message: "Registration successful. You can now log in."
  };
}

/* =========================================================
   LOGIN
========================================================= */

function loginUser(userId, password) {

  ensureUsersSheet();

   

  userId = String(userId || "").trim();
  password = String(password || "");

  if (!userId || !password) {
    throw new Error("Please enter User ID and Password.");
  }

  const sheet = ensureUsersSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error("No registered users found.");
  }

  const values =
    sheet.getRange(2, 1, lastRow - 1, 8).getValues();

  const passwordHash = hashPassword(password);

  for (let i = 0; i < values.length; i++) {

    const row = values[i];

    const storedUserId =
      String(row[0] || "").trim();

    const userName =
      String(row[1] || "").trim();

    const storedPasswordHash =
      String(row[2] || "").trim();

    const userType =
      String(row[3] || "").trim();

    const region =
      String(row[4] || "").trim();

    const branchId =
      String(row[5] || "").trim();

    const branchName =
      String(row[6] || "").trim();

    const status =
      String(row[7] || "").trim();

    if (
      storedUserId.toLowerCase() === userId.toLowerCase()
    ) {

      if (status.toUpperCase() !== "ACTIVE") {
        throw new Error(
          "This user account is not active."
        );
      }

      if (storedPasswordHash !== passwordHash) {
        throw new Error(
          "Invalid User ID or Password."
        );
      }

      return {
        success: true,
        user: {
          userId: storedUserId,
          userName: userName,
          userType: userType,
          region: region,
          branchId: branchId,
          branchName: branchName
        }
      };
    }
  }

  throw new Error(
    "Invalid User ID or Password."
  );
}

function testBranches() {

  const data = getBranchesAndRegions();

  Logger.log(data);

  return data;
}

function testSpreadsheet() {

  const ss = getSpreadsheet();

  Logger.log("Spreadsheet name: " + ss.getName());

  const sheets = ss.getSheets();

  for (let i = 0; i < sheets.length; i++) {
    Logger.log("Sheet: [" + sheets[i].getName() + "]");
  }
}

function getDashboardData(userId) {

  if (!userId) {
    throw new Error("User ID is required.");
  }

  const ss = getSpreadsheet();
  const userSheet = ss.getSheetByName(USERS_SHEET);

  if (!userSheet) {
    throw new Error('The sheet "' + USERS_SHEET + '" was not found.');
  }

  const users = userSheet.getDataRange().getValues();

  let user = null;

  for (let i = 1; i < users.length; i++) {

    const currentUserId = String(users[i][0] || "").trim();

    if (currentUserId.toLowerCase() === String(userId).trim().toLowerCase()) {

      user = {
        userId: currentUserId,
        userName: String(users[i][1] || "").trim(),
        userType: String(users[i][3] || "").trim().toUpperCase(),
        region: String(users[i][4] || "").trim(),
        branchId: String(users[i][5] || "").trim(),
        branchName: String(users[i][6] || "").trim(),
        status: String(users[i][7] || "").trim().toUpperCase()
      };

      break;
    }
  }

  if (!user) {
    throw new Error("User not found.");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("This user account is not active.");
  }

  return {
    success: true,
    user: user,

    categories: {
      consolidated: {
        name: "Consolidated",
        sheet: ""
      },

      below3k: {
        name: "3K",
        sheet: "BELOW 3K"
      },

      threeToTen: {
        name: "3K TO 10 K",
        sheet: "3K TO 10 K"
      },

      above10k: {
        name: "Above 10K",
        sheet: "ABOVE 10 K"
      },

      pallets: {
        name: "Pallets",
        sheet: "Pallets"
      }
    }
  };
}

/************************************************************
 * LADUMA - PENDING CREDIT NOTE WORK AREA
 ************************************************************/

const ACTIVITY_SHEET = "Laduma Activity";


/**
 * Get pending credit-note records for a category.
 *
 * category:
 *   CONSOLIDATED
 *   3K
 *   3K TO 10 K
 *   ABOVE 10 K
 *   PALLETS
 */
function getCreditNoteRecords(userId, category) {

  if (!userId) {
    throw new Error("User ID is required.");
  }

  category = String(category || "").trim().toUpperCase();

  const allowedCategories = [
    "CONSOLIDATED",
    "3K",
    "3K TO 10 K",
    "ABOVE 10 K",
    "PALLETS"
  ];

  if (allowedCategories.indexOf(category) === -1) {
    throw new Error("Invalid category.");
  }

  const user = getLadumaUser(userId);

if (!user) {
  throw new Error("User not found.");
}

if (user.status !== "ACTIVE") {
  throw new Error("This user account is not active.");
}

// =========================================================
// ADMIN BRANCH RESTRICTION
// =========================================================

if (
  user.userType === "ADMIN" &&
  !user.branchName
) {
  throw new Error(
    "This ADMIN user does not have an assigned branch."
  );
}

  const ss = getSpreadsheet();

  let sheets = [];

  if (category === "CONSOLIDATED") {

    sheets = [
      {
        name: "BELOW 3K",
        category: "3K"
      },
      {
        name: "3K TO 10 K",
        category: "3K TO 10 K"
      },
      {
        name: "ABOVE 10 K",
        category: "ABOVE 10 K"
      },
      {
        name: "Pallets",
        category: "PALLETS"
      }
    ];

  } else {

    let sheetName = "";

    if (category === "3K") {
      sheetName = "BELOW 3K";
    }

    if (category === "3K TO 10 K") {
      sheetName = "3K TO 10 K";
    }

    if (category === "ABOVE 10 K") {
      sheetName = "ABOVE 10 K";
    }

    if (category === "PALLETS") {
      sheetName = "Pallets";
    }

    sheets.push({
      name: sheetName,
      category: category
    });
  }


  const activityMap = getActivityMap();

  const result = [];


  sheets.forEach(function(source) {

    const sheet = ss.getSheetByName(source.name);

    if (!sheet) {
      return;
    }

    const values = sheet.getDataRange().getValues();

    if (values.length < 2) {
      return;
    }

    const headers = values[0];

    const columns = getColumnMap(headers);


    for (let r = 1; r < values.length; r++) {

      const row = values[r];

      if (isEmptyRow(row)) {
        continue;
      }


      const branchName =
        getCell(row, columns.branch);

      /*
       * Apply user access restriction.
       */
      if (!userCanAccessBranch(user, branchName)) {
        continue;
      }


      const sourceRow = r + 1;

      const activityKey =
        source.name + "|" + sourceRow;

      const activity =
        activityMap[activityKey] || {};


      /*
       * Completed records removed from pending work
       * are not shown again.
       */
      if (
        String(activity.status || "")
          .toUpperCase() === "REMOVED"
      ) {
        continue;
      }


      const dateValue =
        getCell(row, columns.date);

      const narration =
        getCell(row, columns.narration);

      let invoiceRef =
        getCell(row, columns.ref);

      let grv =
        getCell(row, columns.grv);

      let cnReturn =
        "";


      /*
       * Extract GRV numbers from Narration.
       */
      const extractedGrvs =
        extractGRVs(narration);


      /*
       * If the source GRV column contains a useful GRV,
       * preserve it.
       *
       * Some sheets contain "Debit Note" in the GRV column.
       * That is NOT a GRV, so it is ignored.
       */
      if (!isUsefulGRV(grv)) {

        grv =
          extractedGrvs.join(", ");
      }


      /*
       * If the source GRV exists AND narration contains
       * additional GRVs, include all unique GRVs.
       */
      else {

        const allGrvs =
          [grv].concat(extractedGrvs);

        grv =
          uniqueNonEmpty(allGrvs).join(", ");
      }


      /*
       * Extract C/N / Return Ref separately.
       */
      cnReturn =
        extractCNReturnRef(narration);


      /*
       * Pallets can contain a return-style reference
       * in Ref. No. rather than a normal invoice number.
       *
       * We still keep the original Ref. No. exactly as
       * supplied by the source sheet.
       */
      const followup =
        activity.followup !== undefined
          ? activity.followup
          : getCell(row, columns.feedback);


      const finalRemark =
        activity.finalRemark || "";


      result.push({

        sourceSheet: source.name,

        sourceRow: sourceRow,

        category: source.category,

        date: formatLadumaDate(dateValue),

        supplier:
          getCell(row, columns.supplier),

        invoiceRef:
          invoiceRef,

        grv:
          grv,

        cnReturn:
          cnReturn,

        amount:
          parseLadumaAmount(
            getCell(row, columns.amount)
          ),

        branch:
          branchName,

        narration:
          narration,

        followup:
          followup,

        finalRemark:
          finalRemark
      });
    }
  });


  /*
   * Sort by date, newest first.
   */
  result.sort(function(a, b) {

    const dateA =
      ladumaDateForSort(a.date);

    const dateB =
      ladumaDateForSort(b.date);

    return dateB - dateA;
  });


  return {
    success: true,
    category: category,
    user: user,
    records: result,

    totalPendingAmount:
      result.reduce(function(total, item) {

        /*
         * Credit Received records are still pending
         * until Accounts removes them.
         *
         * Therefore they remain included here.
         */
        return total + Number(item.amount || 0);

      }, 0)
  };
}

/* =========================================================
   ACCOUNTS - CREDIT RECEIVED WAITING FOR REVIEW
   Returns Credit Received records not yet confirmed
   for permanent database deletion.
   ========================================================= */

function getAccountsCreditReceivedRecords(userId) {

  userId =
    String(userId || "").trim();


  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }


  const user =
    getLadumaUser(userId);


  if (!user) {
    throw new Error(
      "User not found."
    );
  }


  if (user.status !== "ACTIVE") {
    throw new Error(
      "This user account is not active."
    );
  }


  if (
    String(user.userType || "")
      .trim()
      .toUpperCase() !== "ACCOUNTS"
  ) {
    throw new Error(
      "Only ACCOUNTS can view Credit Received records."
    );
  }


  /*
   * Use the existing consolidated loader.
   *
   * Records already confirmed by Accounts have status
   * REMOVED and getCreditNoteRecords() automatically
   * excludes them.
   */

  const result =
    getCreditNoteRecords(
      userId,
      "CONSOLIDATED"
    );


  const creditReceivedRecords =
    (result.records || [])
      .filter(function(record) {

        return (
          String(
            record.finalRemark || ""
          )
            .trim()
            .toUpperCase() ===
          "CREDIT RECEIVED"
        );

      })
      .map(function(record) {

        return {

          sourceSheet:
            record.sourceSheet,

          sourceRow:
            record.sourceRow,

          supplier:
            record.supplier || "",

          grv:
            record.grv || "",

          branch:
            record.branch || "",

          invoiceRef:
            record.invoiceRef || "",

          amount:
            Number(record.amount || 0)

        };

      });


  /*
   * Branch first, then Supplier.
   */

  creditReceivedRecords.sort(
    function(a, b) {

      const branchCompare =
        String(a.branch || "")
          .localeCompare(
            String(b.branch || "")
          );


      if (branchCompare !== 0) {
        return branchCompare;
      }


      return String(a.supplier || "")
        .localeCompare(
          String(b.supplier || "")
        );

    }
  );


  return {

    success: true,

    records:
      creditReceivedRecords,

    totalRecords:
      creditReceivedRecords.length,

    totalAmount:
      creditReceivedRecords.reduce(
        function(total, record) {

          return (
            total +
            Number(record.amount || 0)
          );

        },
        0
      )

  };

}


/* =========================================================
   ACCOUNTS - COMPLETE PENDING SUMMARY
   ========================================================= */

function getAccountsPendingSummary(userId) {

  if (!userId) {
    throw new Error("User ID is required.");
  }


  const user = getLadumaUser(userId);

  if (!user) {
    throw new Error("User not found.");
  }


  if (user.status !== "ACTIVE") {
    throw new Error(
      "This user account is not active."
    );
  }


  if (
    String(user.userType || "")
      .trim()
      .toUpperCase() !== "ACCOUNTS"
  ) {
    throw new Error(
      "Accounts access required."
    );
  }


  /*
   * Use the SAME Consolidated function that powers
   * the normal Consolidated button.
   */

  const consolidated =
    getCreditNoteRecords(
      userId,
      "CONSOLIDATED"
    );


  const records =
    consolidated &&
    Array.isArray(consolidated.records)
      ? consolidated.records
      : [];


  /* =====================================================
     CATEGORY TOTALS
     ===================================================== */

  const categoryTotals = {

    consolidated: 0,

    below3k: 0,

    threeToTen: 0,

    above10k: 0,

    pallets: 0

  };


  records.forEach(
    function(record) {

      const amount =
        Number(record.amount) || 0;

      const category =
        String(record.category || "")
          .trim()
          .toUpperCase();


      categoryTotals.consolidated +=
        amount;


      if (category === "3K") {

        categoryTotals.below3k +=
          amount;

      }

      else if (
        category === "3K TO 10 K"
      ) {

        categoryTotals.threeToTen +=
          amount;

      }

      else if (
        category === "ABOVE 10 K"
      ) {

        categoryTotals.above10k +=
          amount;

      }

      else if (
        category === "PALLETS"
      ) {

        categoryTotals.pallets +=
          amount;

      }

    }
  );


  /*
   * Return the consolidated records as well.
   * The popup will use these for Region -> Branch totals.
   */

  return {

    success: true,

    categoryTotals:
      categoryTotals,

    records:
      records

  };

}

/* =========================================================
   ACCOUNTS - TALLY CONTROL HISTORY
   ========================================================= */

function saveAccountsTallyControl(userId, tallyDate, tallyAmount) {

  if (!userId) {
    throw new Error("User ID is required.");
  }

  const user = getLadumaUser(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  if (
    String(user.status || "")
      .trim()
      .toUpperCase() !== "ACTIVE"
  ) {
    throw new Error("This user account is not active.");
  }

  if (
    String(user.userType || "")
      .trim()
      .toUpperCase() !== "ACCOUNTS"
  ) {
    throw new Error("Accounts access required.");
  }


  /* VALIDATE DATE */

  tallyDate =
    String(tallyDate || "").trim();

  if (!tallyDate) {
    throw new Error("Tally date is required.");
  }


  /* VALIDATE AMOUNT */

  tallyAmount =
    Number(tallyAmount);

  if (!isFinite(tallyAmount)) {
    throw new Error("Please enter a valid Tally amount.");
  }


  const ss = getSpreadsheet();

  const sheetName =
    "Tally Control History";

  let sheet =
    ss.getSheetByName(sheetName);


  /* CREATE SHEET FIRST TIME ONLY */

  if (!sheet) {

    sheet =
      ss.insertSheet(sheetName);

    sheet.getRange(
      1,
      1,
      1,
      5
    ).setValues([
      [
        "Tally Date",
        "Tally Amount",
        "Entered By",
        "User ID",
        "Saved At"
      ]
    ]);

    sheet.getRange("A1:E1")
      .setFontWeight("bold");

    sheet.setFrozenRows(1);

  }


  /* SAVE NEW HISTORY ENTRY */

  const nextRow =
    sheet.getLastRow() + 1;


  sheet.getRange(
    nextRow,
    1,
    1,
    5
  ).setValues([
    [
      tallyDate,
      tallyAmount,
      user.userName ||
        user.name ||
        userId,
      userId,
      new Date()
    ]
  ]);


  /* FORMAT */

  sheet.getRange(
    nextRow,
    2
  ).setNumberFormat(
    "#,##0.00"
  );


  sheet.getRange(
    nextRow,
    5
  ).setNumberFormat(
    "dd-mmm-yyyy hh:mm"
  );


  return {
    success: true,
    tallyDate: tallyDate,
    tallyAmount: tallyAmount
  };

}


/* =========================================================
   ACCOUNTS - GET LATEST TALLY CONTROL
   ========================================================= */

function getLatestAccountsTallyControl(userId) {

  if (!userId) {
    throw new Error("User ID is required.");
  }


  const user =
    getLadumaUser(userId);


  if (!user) {
    throw new Error("User not found.");
  }


  if (
    String(user.userType || "")
      .trim()
      .toUpperCase() !== "ACCOUNTS"
  ) {
    throw new Error(
      "Accounts access required."
    );
  }


  const ss =
    getSpreadsheet();


  const sheet =
    ss.getSheetByName(
      "Tally Control History"
    );


  /* NOTHING ENTERED YET */

  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {

    return {
      success: true,
      found: false,
      tallyDate: "",
      tallyAmount: 0
    };

  }


  /*
   * Latest entry is always the last row.
   */

  const lastRow =
    sheet.getLastRow();


  const values =
    sheet.getRange(
      lastRow,
      1,
      1,
      5
    ).getValues()[0];


  return {
    success: true,
    found: true,

    tallyDate:
      String(values[0] || ""),

    tallyAmount:
      Number(values[1]) || 0,

    enteredBy:
      String(values[2] || ""),

    savedAt:
      values[4] || ""
  };

}

/************************************************************
 * USER
 ************************************************************/

function getLadumaUser(userId) {

  const ss = getSpreadsheet();

  const sheet =
    ss.getSheetByName(USERS_SHEET);

  if (!sheet) {
    throw new Error(
      'The sheet "' +
      USERS_SHEET +
      '" was not found.'
    );
  }

  const values =
    sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {

    const currentId =
      String(values[i][0] || "").trim();

    if (
      currentId.toLowerCase() ===
      String(userId).trim().toLowerCase()
    ) {

      return {

        userId: currentId,

        userName:
          String(values[i][1] || "").trim(),

        userType:
          String(values[i][3] || "")
            .trim()
            .toUpperCase(),

        region:
          String(values[i][4] || "").trim(),

        branchId:
          String(values[i][5] || "").trim(),

        branchName:
          String(values[i][6] || "").trim(),

        status:
          String(values[i][7] || "")
            .trim()
            .toUpperCase()
      };
    }
  }

  return null;
}


/************************************************************
 * ACCESS CONTROL
 ************************************************************/

function userCanAccessBranch(user, branchName) {

  const userType =
    String(user.userType || "")
      .trim()
      .toUpperCase();

  branchName =
    String(branchName || "").trim();


  /*
   * ACCOUNTS sees everything.
   */
  if (userType === "ACCOUNTS") {
    return true;
  }


  /*
   * ADMIN sees only assigned branch.
   */
  if (userType === "ADMIN") {

    return (
      branchName.toLowerCase() ===
      String(user.branchName || "")
        .trim()
        .toLowerCase()
    );
  }


  /*
   * TEAM LEADER sees every branch belonging
   * to the assigned region.
   */
  if (userType === "TEAM LEADER") {

    const branchInfo =
      getBranchInfo(branchName);

    if (!branchInfo) {
      return false;
    }

    return (
      String(branchInfo.region || "")
        .trim()
        .toLowerCase() ===
      String(user.region || "")
        .trim()
        .toLowerCase()
    );
  }


  return false;
}


/************************************************************
 * BRANCH LOOKUP
 ************************************************************/

function getBranchInfo(branchName) {

  const ss = getSpreadsheet();

  const sheet =
    ss.getSheetByName(BRANCH_SHEET);

  if (!sheet) {
    return null;
  }

  const values =
    sheet.getDataRange().getValues();

  const wanted =
    String(branchName || "")
      .trim()
      .toLowerCase();


  for (let i = 1; i < values.length; i++) {

    const currentName =
      String(values[i][1] || "")
        .trim()
        .toLowerCase();

    if (currentName === wanted) {

      return {
        branchId:
          String(values[i][0] || "").trim(),

        branchName:
          String(values[i][1] || "").trim(),

        region:
          String(values[i][2] || "").trim()
      };
    }
  }

  return null;
}


/************************************************************
 * HEADER MAP
 ************************************************************/

function getColumnMap(headers) {

  const map = {

    date: -1,
    ref: -1,
    grv: -1,
    supplier: -1,
    amount: -1,
    branch: -1,
    feedback: -1,
    narration: -1
  };


  for (let i = 0; i < headers.length; i++) {

    const header =
      String(headers[i] || "")
        .trim()
        .toLowerCase();


    if (
      header === "date"
    ) {
      map.date = i;
    }

    else if (
      header === "ref. no." ||
      header === "ref no." ||
      header === "reference no."
    ) {
      map.ref = i;
    }

    else if (
      header === "grv no." ||
      header === "grv no"
    ) {
      map.grv = i;
    }

    else if (
      header === "supplier's name" ||
      header === "supplier name" ||
      header === "supplier"
    ) {
      map.supplier = i;
    }

    else if (
      header === "amount"
    ) {
      map.amount = i;
    }

    else if (
      header === "branch"
    ) {
      map.branch = i;
    }

    else if (
      header === "feedback" ||
      header === "feed back"
    ) {
      map.feedback = i;
    }

    else if (
      header === "narrration" ||
      header === "narration"
    ) {
      map.narration = i;
    }
  }


  return map;
}


/************************************************************
 * CELL HELPER
 ************************************************************/

function getCell(row, columnIndex) {

  if (
    columnIndex === undefined ||
    columnIndex === null ||
    columnIndex < 0
  ) {
    return "";
  }

  return row[columnIndex] === null ||
         row[columnIndex] === undefined
    ? ""
    : row[columnIndex];
}


/************************************************************
 * EMPTY ROW
 ************************************************************/

function isEmptyRow(row) {

  for (let i = 0; i < row.length; i++) {

    if (
      row[i] !== null &&
      row[i] !== undefined &&
      String(row[i]).trim() !== ""
    ) {
      return false;
    }
  }

  return true;
}


/************************************************************
 * GRV EXTRACTION
 ************************************************************/

function extractGRVs(narration) {

  const text =
    String(narration || "");

  const results = [];

  /*
   * Finds:
   * GRV NO. ABC123
   * GRV NO ABC123
   * GRV NUMBER ABC123
   */
  const regex =
    /\bGRV\s*(?:NO\.?|NUMBER)\s*[:\-]?\s*([A-Z0-9\/_-]+)/gi;

  let match;

  while (
    (match = regex.exec(text)) !== null
  ) {

    const value =
      String(match[1] || "").trim();

    if (
      value &&
      isUsefulGRV(value)
    ) {
      results.push(value);
    }
  }

  return uniqueNonEmpty(results);
}


/************************************************************
 * C/N / RETURN REF EXTRACTION
 ************************************************************/

function extractCNReturnRef(narration) {

  const text =
    String(narration || "");


  /*
   * Look for:
   *
   * C/N NO. ABC123
   * C/N NO ABC123
   * C/N NUMBER ABC123
   *
   * Also allows:
   * C/N NO. - DT. - ABC123
   *
   * We intentionally look after the C/N marker
   * and ignore "-" / "DT." placeholders.
   */


  const marker =
    /\bC\s*\/\s*N\s*(?:NO\.?|NUMBER)\b/i;

  const found =
    marker.exec(text);

  if (!found) {
    return "";
  }


  let remainder =
    text.substring(
      found.index + found[0].length
    );


  /*
   * Stop at another obvious field marker.
   */
  remainder =
    remainder.split(
      /\b(?:GRV\s*(?:NO\.?|NUMBER)|SLIP\s*(?:NO\.?|NUMBER)|DT\.?)\b/i
    )[0];


  /*
   * Find a code-like value.
   */
  const matches =
    remainder.match(
      /\b[A-Z]{2,}[A-Z0-9\/_-]*\d[A-Z0-9\/_-]*\b/gi
    );


  if (!matches || matches.length === 0) {
    return "";
  }


  return String(matches[matches.length - 1])
    .trim();
}


/************************************************************
 * GRV VALIDATION
 ************************************************************/

function isUsefulGRV(value) {

  const text =
    String(value || "").trim();

  if (!text) {
    return false;
  }


  /*
   * These are known non-GRV values.
   */
  const invalid = [
    "DEBIT NOTE",
    "N/A",
    "NA",
    "-"
  ];


  if (
    invalid.indexOf(
      text.toUpperCase()
    ) !== -1
  ) {
    return false;
  }


  return true;
}


/************************************************************
 * UNIQUE VALUES
 ************************************************************/

function uniqueNonEmpty(values) {

  const result = [];

  const seen = {};

  values.forEach(function(value) {

    const text =
      String(value || "").trim();

    if (!text) {
      return;
    }

    const key =
      text.toUpperCase();

    if (!seen[key]) {

      seen[key] = true;

      result.push(text);
    }
  });

  return result;
}


/************************************************************
 * AMOUNT
 ************************************************************/

function parseLadumaAmount(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }


  if (typeof value === "number") {
    return value;
  }


  let text =
    String(value)
      .trim()
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, "");


  const number =
    parseFloat(text);

  return isNaN(number)
    ? 0
    : number;
}


/************************************************************
 * DATE DISPLAY
 ************************************************************/

function formatLadumaDate(value) {

  if (!value) {
    return "";
  }


  if (
    Object.prototype.toString.call(value) ===
    "[object Date]"
  ) {

    if (isNaN(value.getTime())) {
      return "";
    }

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "dd-MMM-yyyy"
    );
  }


  const text =
    String(value).trim();


  /*
   * Try to interpret string dates.
   */
  const parsed =
    new Date(text);

  if (!isNaN(parsed.getTime())) {

    return Utilities.formatDate(
      parsed,
      Session.getScriptTimeZone(),
      "dd-MMM-yyyy"
    );
  }


  return text;
}


/************************************************************
 * DATE SORT
 ************************************************************/

function ladumaDateForSort(value) {

  if (!value) {
    return 0;
  }

  const parsed =
    new Date(value);

  if (isNaN(parsed.getTime())) {
    return 0;
  }

  return parsed.getTime();
}


/************************************************************
 * ACTIVITY DATA
 ************************************************************/

function getActivityMap() {

  const ss =
    getSpreadsheet();

  const sheet =
    ss.getSheetByName(ACTIVITY_SHEET);


  /*
   * Activity sheet may not yet contain records.
   */
  if (!sheet) {
    return {};
  }


  const values =
    sheet.getDataRange().getValues();


  if (values.length < 2) {
    return {};
  }


  const headers =
    values[0].map(function(header) {

      return String(header || "")
        .trim()
        .toLowerCase();
    });


  const sourceSheetCol =
    headers.indexOf("source sheet");

  const sourceRowCol =
    headers.indexOf("source row");

  const followupCol =
    headers.indexOf("followup");

  const finalRemarkCol =
    headers.indexOf("final remark");

  const statusCol =
    headers.indexOf("completed/removed");


  const map = {};


  for (let i = 1; i < values.length; i++) {

    const row =
      values[i];


    const sourceSheet =
      sourceSheetCol >= 0
        ? String(row[sourceSheetCol] || "").trim()
        : "";


    const sourceRow =
      sourceRowCol >= 0
        ? String(row[sourceRowCol] || "").trim()
        : "";


    if (!sourceSheet || !sourceRow) {
      continue;
    }


    const key =
      sourceSheet + "|" + sourceRow;


    map[key] = {

      followup:
        followupCol >= 0
          ? String(row[followupCol] || "")
          : "",

      finalRemark:
        finalRemarkCol >= 0
          ? String(row[finalRemarkCol] || "")
          : "",

      status:
        statusCol >= 0
          ? String(row[statusCol] || "")
          : ""
    };
  }


  return map;
}


function testDashboardData() {

  const result = getDashboardData("sree");

  Logger.log(JSON.stringify(result, null, 2));

}

/************************************************************
 * SAVE CREDIT NOTE FOLLOWUP / FINAL REMARK
 ************************************************************/

function saveCreditNoteUpdate(data) {

  if (!data) {
    throw new Error("No update data received.");
  }

  const userId =
    String(data.userId || "").trim();

  const sourceSheet =
    String(data.sourceSheet || "").trim();

  const sourceRow =
    Number(data.sourceRow);

  const followup =
    String(data.followup || "").trim();

  const finalRemark =
    String(data.finalRemark || "").trim();


  if (!userId) {
    throw new Error("User ID is required.");
  }

  if (!sourceSheet) {
    throw new Error("Source sheet is required.");
  }

  if (!sourceRow || sourceRow < 2) {
    throw new Error("Invalid source row.");
  }


  /*
   * Verify the user.
   */
  const user =
    getLadumaUser(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  if (user.status !== "ACTIVE") {
    throw new Error(
      "This user account is not active."
    );
  }


  /*
   * Only ADMIN, TEAM LEADER and ACCOUNTS
   * can update records.
   */
  const allowedTypes = [
    "ADMIN",
    "TEAM LEADER",
    "ACCOUNTS"
  ];

  if (
    allowedTypes.indexOf(
      user.userType
    ) === -1
  ) {
    throw new Error(
      "You do not have permission to update records."
    );
  }


  /*
   * Validate Final Remark.
   */
  const allowedRemarks = [
    "",
    "Credit Still Pending",
    "Credit Received"
  ];

  if (
    allowedRemarks.indexOf(finalRemark) === -1
  ) {
    throw new Error(
      "Invalid Final Remark."
    );
  }


  const ss =
    getSpreadsheet();

  const source =
    ss.getSheetByName(sourceSheet);


  if (!source) {
    throw new Error(
      'The source sheet "' +
      sourceSheet +
      '" was not found.'
    );
  }


  /*
   * Confirm that the source row actually exists.
   */
  if (
    sourceRow >
    source.getLastRow()
  ) {
    throw new Error(
      "The selected source record no longer exists."
    );
  }


  /*
   * Determine the branch of this record.
   */
  const headers =
    source
      .getRange(
        1,
        1,
        1,
        source.getLastColumn()
      )
      .getValues()[0];

  const columns =
    getColumnMap(headers);


  const branchName =
    columns.branch >= 0
      ? String(
          source
            .getRange(
              sourceRow,
              columns.branch + 1
            )
            .getValue() || ""
        ).trim()
      : "";


  /*
   * Re-check access.
   *
   * This prevents a user from manually sending
   * another branch's source row.
   */
  if (
    !userCanAccessBranch(
      user,
      branchName
    )
  ) {
    throw new Error(
      "You do not have permission to update this record."
    );
  }


  /*
   * Find existing Activity record.
   */
  const activitySheet =
    getOrCreateActivitySheet();


  const activityValues =
    activitySheet
      .getDataRange()
      .getValues();


  let existingRow = -1;


  for (
    let i = 1;
    i < activityValues.length;
    i++
  ) {

    const existingSourceSheet =
      String(
        activityValues[i][0] || ""
      ).trim();

    const existingSourceRow =
      Number(
        activityValues[i][1]
      );


    if (
      existingSourceSheet ===
        sourceSheet &&
      existingSourceRow ===
        sourceRow
    ) {

      existingRow =
        i + 1;

      break;
    }
  }


  const now =
    new Date();


  /*
   * A record is NOT removed simply because
   * "Credit Received" is selected.
   *
   * Accounts can remove it later.
   */
  const completedRemoved =
    existingRow > 0
      ? String(
          activitySheet
            .getRange(existingRow, 7)
            .getValue() || ""
        ).trim()
      : "";


  const rowData = [

    sourceSheet,

    sourceRow,

    followup,

    finalRemark,

    user.userId,

    now,

    completedRemoved
  ];


  if (existingRow > 0) {

    activitySheet
      .getRange(
        existingRow,
        1,
        1,
        7
      )
      .setValues([rowData]);

  } else {

    activitySheet.appendRow(rowData);
  }


  return {

    success: true,

    message:
      "Credit note update saved successfully."
  };
}

/************************************************************
 * ACCOUNTS - REMOVE COMPLETED CREDIT NOTE FROM PENDING
 ************************************************************/

function removeCreditNoteFromPending(data) {

  if (!data) {
    throw new Error(
      "No credit note data received."
    );
  }


  const userId =
    String(data.userId || "").trim();

  const sourceSheet =
    String(data.sourceSheet || "").trim();

  const sourceRow =
    Number(data.sourceRow);


  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  if (!sourceSheet) {
    throw new Error(
      "Source sheet is required."
    );
  }

  if (!sourceRow || sourceRow < 2) {
    throw new Error(
      "Invalid source row."
    );
  }


  /*
   * Verify logged-in user.
   */
  const user =
    getLadumaUser(userId);

  if (!user) {
    throw new Error(
      "User not found."
    );
  }

  if (user.status !== "ACTIVE") {
    throw new Error(
      "This user account is not active."
    );
  }


  /*
   * ONLY ACCOUNTS can remove a record
   * from Pending Credit Notes.
   */
  if (user.userType !== "ACCOUNTS") {
    throw new Error(
      "Only ACCOUNTS can remove completed credit notes."
    );
  }


  const ss =
    getSpreadsheet();

  const source =
    ss.getSheetByName(sourceSheet);

  if (!source) {
    throw new Error(
      'The source sheet "' +
      sourceSheet +
      '" was not found.'
    );
  }


  if (sourceRow > source.getLastRow()) {
    throw new Error(
      "The selected source record no longer exists."
    );
  }


  /*
   * Locate the Activity record.
   */
  const activitySheet =
    getOrCreateActivitySheet();

  const values =
    activitySheet
      .getDataRange()
      .getValues();


  let activityRow = -1;


  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const existingSourceSheet =
      String(values[i][0] || "")
        .trim();

    const existingSourceRow =
      Number(values[i][1]);


    if (
      existingSourceSheet === sourceSheet &&
      existingSourceRow === sourceRow
    ) {

      activityRow = i + 1;
      break;
    }
  }


  /*
   * Credit Received must already have been
   * saved before Accounts can remove it.
   */
  if (activityRow < 2) {
    throw new Error(
      "Please save Credit Received before confirming removal."
    );
  }


  const finalRemark =
    String(
      activitySheet
        .getRange(activityRow, 4)
        .getValue() || ""
    ).trim();


  if (finalRemark !== "Credit Received") {
    throw new Error(
      'Final Remark must be "Credit Received" before removal.'
    );
  }


  /*
   * IMPORTANT:
   * Do NOT delete the original source row.
   *
   * Column 7 of Laduma Activity is:
   * Completed/Removed
   */
  activitySheet
    .getRange(activityRow, 7)
    .setValue("REMOVED");
    /*
 * Mark the original database row visually
 * as Credit Received / waiting for monthly cleanup.
 *
 * Very light pink = #FCE8E6
 */
source
  .getRange(
    sourceRow,
    1,
    1,
    source.getLastColumn()
  )
  .setBackground("#FCE8E6");


  /*
   * Record who completed the removal
   * and when.
   */
  activitySheet
    .getRange(activityRow, 5)
    .setValue(user.userId);

  activitySheet
    .getRange(activityRow, 6)
    .setValue(new Date());


  return {

    success: true,

    message:
      "Credit received record removed from pending successfully."
  };
}


/************************************************************
 * ACCOUNTS - MONTHLY CLEANUP PREVIEW
 * Counts REMOVED records waiting for permanent cleanup.
 * DOES NOT DELETE OR MODIFY ANY DATA.
 ************************************************************/
function getMonthlyCleanupPreview(userId) {

  userId = String(userId || "").trim();

  if (!userId) {
    throw new Error("User ID is required.");
  }


  // Verify user
  const user = getLadumaUser(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("This user account is not active.");
  }

  if (user.userType !== "ACCOUNTS") {
    throw new Error(
      "Only ACCOUNTS can perform monthly database cleanup."
    );
  }


  const ss = getSpreadsheet();

  const activitySheet =
    ss.getSheetByName(ACTIVITY_SHEET);

  if (!activitySheet ||
      activitySheet.getLastRow() < 2) {

    return {
      success: true,
      total: 0,
      sheets: {}
    };
  }


  const values =
    activitySheet.getDataRange().getValues();

  const allowedSheets = [
    "BELOW 3K",
    "3K TO 10 K",
    "ABOVE 10 K",
    "Pallets"
  ];


  const counts = {
    "BELOW 3K": 0,
    "3K TO 10 K": 0,
    "ABOVE 10 K": 0,
    "Pallets": 0
  };

  let total = 0;


  /*
   * Laduma Activity columns:
   *
   * A = Source Sheet
   * B = Source Row
   * G = Completed/Removed
   */
  for (let i = 1; i < values.length; i++) {

    const sourceSheet =
      String(values[i][0] || "").trim();

    const sourceRow =
      Number(values[i][1]);

    const status =
      String(values[i][6] || "")
        .trim()
        .toUpperCase();


    if (status !== "REMOVED") {
      continue;
    }


    if (allowedSheets.indexOf(sourceSheet) === -1) {
      continue;
    }


    /*
     * Verify that the referenced database row
     * still exists before counting it.
     */
    const source =
      ss.getSheetByName(sourceSheet);

    if (!source) {
      continue;
    }

    if (
      !sourceRow ||
      sourceRow < 2 ||
      sourceRow > source.getLastRow()
    ) {
      continue;
    }


    counts[sourceSheet]++;
    total++;
  }


  return {
    success: true,
    total: total,
    sheets: counts
  };
}

/************************************************************
 * ACCOUNTS - PERMANENT MONTHLY DATABASE CLEANUP
 *
 * 1. Finds Laduma Activity records marked REMOVED.
 * 2. Permanently deletes the FULL source rows.
 * 3. Deletes corresponding Activity records.
 * 4. Corrects Source Row references for remaining Activity.
 *
 * IMPORTANT:
 * Source rows are deleted from bottom to top.
 ************************************************************/
function performMonthlyDatabaseCleanup(userId) {

  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(30000);

    } catch (error) {

    throw new Error(
      "Another database cleanup is currently running. Please try again shortly."
    );
  }


  try {

    userId = String(userId || "").trim();

    if (!userId) {
      throw new Error("User ID is required.");
    }


  // -------------------------------------------------------
  // VERIFY ACCOUNTS USER
  // -------------------------------------------------------

  const user = getLadumaUser(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  if (user.status !== "ACTIVE") {
    throw new Error(
      "This user account is not active."
    );
  }

  if (user.userType !== "ACCOUNTS") {
    throw new Error(
      "Only ACCOUNTS can perform monthly database cleanup."
    );
  }


  const ss = getSpreadsheet();

  const activitySheet =
    ss.getSheetByName(ACTIVITY_SHEET);

  if (
    !activitySheet ||
    activitySheet.getLastRow() < 2
  ) {

    return {
      success: true,
      totalDeleted: 0,
      message:
        "There are no records waiting for cleanup."
    };
  }


  const activityValues =
    activitySheet.getDataRange().getValues();


  const allowedSheets = [
    "BELOW 3K",
    "3K TO 10 K",
    "ABOVE 10 K",
    "Pallets"
  ];


  /*
   * deletedRowsBySheet will contain:
   *
   * {
   *   "BELOW 3K": [304, 250],
   *   "3K TO 10 K": [100],
   *   ...
   * }
   */
  const deletedRowsBySheet = {};

  allowedSheets.forEach(function(sheetName) {
    deletedRowsBySheet[sheetName] = [];
  });


  /*
   * Keep the Activity sheet row numbers that must
   * eventually be deleted.
   */
  const activityRowsToDelete = [];


  // -------------------------------------------------------
  // IDENTIFY REMOVED RECORDS
  // -------------------------------------------------------

  for (
    let i = 1;
    i < activityValues.length;
    i++
  ) {

    const sourceSheet =
      String(activityValues[i][0] || "")
        .trim();

    const sourceRow =
      Number(activityValues[i][1]);

    const status =
      String(activityValues[i][6] || "")
        .trim()
        .toUpperCase();


    if (status !== "REMOVED") {
      continue;
    }


    if (
      allowedSheets.indexOf(sourceSheet) === -1
    ) {
      continue;
    }


    const source =
      ss.getSheetByName(sourceSheet);

    if (!source) {
      continue;
    }


    /*
     * Only include a valid existing database row.
     */
    if (
      !sourceRow ||
      sourceRow < 2 ||
      sourceRow > source.getLastRow()
    ) {
      continue;
    }


    deletedRowsBySheet[sourceSheet]
      .push(sourceRow);

    activityRowsToDelete.push(i + 1);
  }


  // -------------------------------------------------------
  // REMOVE DUPLICATE SOURCE ROW NUMBERS
  // AND SORT LOW -> HIGH FOR REFERENCE CALCULATION
  // -------------------------------------------------------

  allowedSheets.forEach(function(sheetName) {

    const uniqueRows = [];

    deletedRowsBySheet[sheetName]
      .forEach(function(rowNumber) {

        if (
          uniqueRows.indexOf(rowNumber) === -1
        ) {
          uniqueRows.push(rowNumber);
        }

      });


    uniqueRows.sort(function(a, b) {
      return a - b;
    });


    deletedRowsBySheet[sheetName] =
      uniqueRows;
  });


  let totalDeleted = 0;


  allowedSheets.forEach(function(sheetName) {
    totalDeleted +=
      deletedRowsBySheet[sheetName].length;
  });


  if (totalDeleted === 0) {

    return {
      success: true,
      totalDeleted: 0,
      message:
        "There are no valid records waiting for cleanup."
    };
  }


  // -------------------------------------------------------
  // FIRST CORRECT SOURCE ROW REFERENCES
  // FOR ACTIVITY RECORDS THAT WILL REMAIN.
  //
  // Example:
  // If source row 20 is deleted,
  // old row 25 becomes row 24.
  // -------------------------------------------------------

  for (
    let i = 1;
    i < activityValues.length;
    i++
  ) {

    const activitySheetRow = i + 1;


    /*
     * Do not update an Activity record that itself
     * is going to be deleted.
     */
    if (
      activityRowsToDelete.indexOf(
        activitySheetRow
      ) !== -1
    ) {
      continue;
    }


    const sourceSheet =
      String(activityValues[i][0] || "")
        .trim();

    const oldSourceRow =
      Number(activityValues[i][1]);


    if (
      allowedSheets.indexOf(sourceSheet) === -1 ||
      !oldSourceRow
    ) {
      continue;
    }


    const deletedRows =
      deletedRowsBySheet[sourceSheet];


    let rowsDeletedAbove = 0;


    deletedRows.forEach(function(
      deletedRow
    ) {

      if (deletedRow < oldSourceRow) {
        rowsDeletedAbove++;
      }

    });


    if (rowsDeletedAbove > 0) {

      const newSourceRow =
        oldSourceRow - rowsDeletedAbove;

      activitySheet
        .getRange(
          activitySheetRow,
          2
        )
        .setValue(newSourceRow);
    }
  }


  // -------------------------------------------------------
  // DELETE FULL SOURCE DATABASE ROWS
  // HIGHEST ROW FIRST
  // -------------------------------------------------------

  allowedSheets.forEach(function(sheetName) {

    const source =
      ss.getSheetByName(sheetName);

    if (!source) {
      return;
    }


    const rows =
      deletedRowsBySheet[sheetName]
        .slice()
        .sort(function(a, b) {
          return b - a;
        });


    rows.forEach(function(rowNumber) {

      source.deleteRow(rowNumber);

    });
  });


  // -------------------------------------------------------
  // DELETE COMPLETED ACTIVITY ROWS
  // HIGHEST ROW FIRST
  // -------------------------------------------------------

  activityRowsToDelete
    .sort(function(a, b) {
      return b - a;
    });


  activityRowsToDelete
    .forEach(function(rowNumber) {

      activitySheet.deleteRow(rowNumber);

    });


  SpreadsheetApp.flush();


  // -------------------------------------------------------
  // RESULT
  // -------------------------------------------------------

  return {

    success: true,

    totalDeleted:
      totalDeleted,

    sheets: {
      below3k:
        deletedRowsBySheet["BELOW 3K"].length,

      threeToTen:
        deletedRowsBySheet["3K TO 10 K"].length,

      above10k:
        deletedRowsBySheet["ABOVE 10 K"].length,

      pallets:
        deletedRowsBySheet["Pallets"].length
    },

    message:
      totalDeleted +
      " Credit Received record(s) permanently cleaned from the database."
  };
  } finally {

    if (lock.hasLock()) {
      lock.releaseLock();
    }

  }
}



/************************************************************
 * CREATE ACTIVITY SHEET IF NEEDED
 ************************************************************/

function getOrCreateActivitySheet() {

  const ss =
    getSpreadsheet();

  let sheet =
    ss.getSheetByName(
      ACTIVITY_SHEET
    );


  if (!sheet) {

    sheet =
      ss.insertSheet(
        ACTIVITY_SHEET
      );

    sheet
      .getRange(
        1,
        1,
        1,
        7
      )
      .setValues([[
        "Source Sheet",
        "Source Row",
        "Followup",
        "Final Remark",
        "Last Updated By",
        "Last Updated Date",
        "Completed/Removed"
      ]]);
  }


  return sheet;
}

/* =========================================================
   ADMIN - SAVE NEW CREDIT NOTE ENTRY
   ========================================================= */

function saveAdminNewEntry(data) {

  try {

    if (!data) {
      throw new Error("No entry data received.");
    }

    // -----------------------------------------------------
    // BASIC VALIDATION
    // -----------------------------------------------------

    var userId =
      String(data.userId || "").trim();

    var entryType =
      String(data.entryType || "")
        .trim()
        .toUpperCase();

    var grvNo =
      String(data.grvNo || "").trim();

    var grvDateText =
      String(data.grvDate || "").trim();

    var supplierName =
      String(data.supplierName || "").trim();

    var returnGrvNo =
      String(data.returnGrvNo || "").trim();

    var invoiceNo =
      String(data.invoiceNo || "").trim();

    var narration =
      String(data.narration || "").trim();

    var amount =
      Number(data.amount);

    var palletQty =
      String(data.palletQty || "").trim();

      // -----------------------------------------------------
      // BUILD FINAL NARRATION
      // -----------------------------------------------------

    var narrationParts = [];

    if (narration) {
      narrationParts.push(narration);
    }

if (grvNo) {
  narrationParts.push(
    "GRV NO. " + grvNo
  );
}

if (returnGrvNo) {
  narrationParts.push(
    "RETURN GRV NO. " + returnGrvNo
  );
}

if (invoiceNo) {
  narrationParts.push(
    "INV NO. " + invoiceNo
  );
}

narration =
  narrationParts.join(" - ");


    if (!userId) {
      throw new Error(
        "Logged-in user could not be identified."
      );
    }

    if (entryType !== "NORMAL" &&
        entryType !== "PALLET") {

      throw new Error(
        "Please select a valid Entry Type."
      );
    }

    // GRV No. is required only for NORMAL entries
if (entryType !== "PALLET" && !grvNo) {
  throw new Error("GRV No. is required.");
}

// Return GRV No. is required for PALLET entries
if (entryType === "PALLET" && !returnGrvNo) {
  throw new Error(
    "Return GRV No. is required for Pallet entries."
  );
}

    if (!grvDateText) {
      throw new Error("GRV Date is required.");
    }

    if (!supplierName) {
      throw new Error("Supplier Name is required.");
    }

    if (!invoiceNo) {
      throw new Error(
        "Invoice / Slip No. is required."
      );
    }

    if (!isFinite(amount) || amount <= 0) {
      throw new Error(
        "Please enter a valid Amount."
      );
    }

    if (entryType === "PALLET" &&
        !palletQty) {

      throw new Error(
        "Pallet Qty is required for Pallet entries."
      );
    }


    // -----------------------------------------------------
    // VERIFY LOGGED-IN ADMIN FROM LADUMA USERS
    // -----------------------------------------------------

    var ss =
      SpreadsheetApp.openById(
        SPREADSHEET_ID
      );

    var userSheet =
      ss.getSheetByName(
        USERS_SHEET
      );

    if (!userSheet) {
      throw new Error(
        "Laduma Users sheet was not found."
      );
    }

    var userData =
      userSheet.getDataRange().getValues();

    if (userData.length < 2) {
      throw new Error(
        "No users were found in Laduma Users."
      );
    }

    var headers =
      userData[0].map(function(value) {
        return String(value || "")
          .trim()
          .toUpperCase();
      });


    function findHeader(names) {

      for (var i = 0; i < names.length; i++) {

        var index =
          headers.indexOf(
            names[i].toUpperCase()
          );

        if (index !== -1) {
          return index;
        }
      }

      return -1;
    }


    var userIdCol =
      findHeader([
        "USER ID",
        "USERID"
      ]);

    var userNameCol =
      findHeader([
        "USER NAME",
        "USERNAME",
        "NAME"
      ]);

    var userTypeCol =
      findHeader([
        "USER TYPE",
        "USERTYPE",
        "ROLE"
      ]);

    var branchNameCol =
      findHeader([
        "BRANCH NAME",
        "BRANCH"
      ]);


    if (userIdCol === -1 ||
        userNameCol === -1 ||
        userTypeCol === -1 ||
        branchNameCol === -1) {

      throw new Error(
        "Required columns were not found in Laduma Users."
      );
    }


    var adminName = "";
    var branchName = "";
    var userFound = false;


    for (var r = 1; r < userData.length; r++) {

      var sheetUserId =
        String(
          userData[r][userIdCol] || ""
        ).trim();

      if (sheetUserId === userId) {

        var sheetUserType =
          String(
            userData[r][userTypeCol] || ""
          )
          .trim()
          .toUpperCase();

        if (sheetUserType !== "ADMIN") {

          throw new Error(
            "Only ADMIN users can create new entries."
          );
        }

        adminName =
          String(
            userData[r][userNameCol] || ""
          ).trim();

        branchName =
          String(
            userData[r][branchNameCol] || ""
          ).trim();

        userFound = true;
        break;
      }
    }


    if (!userFound) {
      throw new Error(
        "Logged-in ADMIN was not found."
      );
    }

    if (!branchName) {
      throw new Error(
        "No branch is assigned to this ADMIN."
      );
    }


    // -----------------------------------------------------
    // DETERMINE DESTINATION SHEET
    // -----------------------------------------------------

    var destinationSheetName = "";

    if (entryType === "PALLET") {

      destinationSheetName = "Pallets";

    } else if (amount < 3000) {

      destinationSheetName = "BELOW 3K";

    } else if (amount <= 10000) {

      destinationSheetName = "3K TO 10 K";

    } else {

      destinationSheetName = "ABOVE 10 K";
    }


    var destinationSheet =
      ss.getSheetByName(
        destinationSheetName
      );

    if (!destinationSheet) {

      throw new Error(
        "Destination sheet '" +
        destinationSheetName +
        "' was not found."
      );
    }


    // -----------------------------------------------------
    // CONVERT GRV DATE SAFELY
    // yyyy-mm-dd -> local Date
    // -----------------------------------------------------

    var dateParts =
  grvDateText.split("-");

if (dateParts.length !== 3) {
  throw new Error(
    "Invalid GRV Date."
  );
}

var year =
  Number(dateParts[0]);

var month =
  Number(dateParts[1]);

var day =
  Number(dateParts[2]);

if (!year ||
    !month ||
    !day ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31) {

  throw new Error(
    "Invalid GRV Date."
  );
}

/*
  Create the date at 12:00 noon instead of midnight.

  This prevents timezone conversion from shifting
  the selected date to the previous day.
*/
var grvDate =
  new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0
  );


    // -----------------------------------------------------
    // NEXT AVAILABLE ROW
    // -----------------------------------------------------

    var newRow =
      destinationSheet.getLastRow() + 1;


    // -----------------------------------------------------
    // COMMON COLUMNS
    //
    // B = Invoice / Slip No.
    // E = Supplier Name
    // F = Amount
    // G/H/etc depend on destination
    // -----------------------------------------------------

    destinationSheet
      .getRange(newRow, 2)
      .setValue(invoiceNo);

    destinationSheet
      .getRange(newRow, 5)
      .setValue(supplierName);

    destinationSheet
      .getRange(newRow, 6)
      .setValue(amount);

    destinationSheet
      .getRange(newRow, 8)
      .setValue(grvNo);

    destinationSheet
      .getRange(newRow, 9)
      .setValue(grvDate)
      .setNumberFormat("dd-mmm-yyyy");


    // -----------------------------------------------------
    // SHEET-SPECIFIC COLUMN MAPPING
    // -----------------------------------------------------

    if (destinationSheetName === "BELOW 3K") {

  // A = GRV Date
  destinationSheet.getRange(newRow, 1)
    .setValue(grvDate)
    .setNumberFormat("dd-mmm-yyyy");

  // B = Invoice / Slip No.
  destinationSheet.getRange(newRow, 2)
    .setValue(invoiceNo);

  // C = GRV No.
  destinationSheet.getRange(newRow, 3)
    .setValue(grvNo);

  // E = Supplier Name
  destinationSheet.getRange(newRow, 5)
    .setValue(supplierName);

  // F = Amount
  destinationSheet.getRange(newRow, 6)
    .setValue(amount);

  // G = Branch
  destinationSheet.getRange(newRow, 7)
    .setValue(branchName);

  // H = Return GRV No.
  destinationSheet.getRange(newRow, 8)
    .setValue(returnGrvNo);

  // I = Admin Name
  destinationSheet.getRange(newRow, 9)
    .setValue(adminName);

  // O = Narration
  destinationSheet.getRange(newRow, 15)
    .setValue(narration);


    } else if (
  destinationSheetName === "3K TO 10 K"
) {

  // A = GRV Date
  destinationSheet.getRange(newRow, 1)
    .setValue(grvDate)
    .setNumberFormat("dd-mmm-yyyy");

  // B = Invoice / Slip No.
  destinationSheet.getRange(newRow, 2)
    .setValue(invoiceNo);

  // C = GRV No.
  destinationSheet.getRange(newRow, 3)
    .setValue(grvNo);

  // E = Supplier Name
  destinationSheet.getRange(newRow, 5)
    .setValue(supplierName);

  // F = Amount
  destinationSheet.getRange(newRow, 6)
    .setValue(amount);

  // G = Branch
  destinationSheet.getRange(newRow, 7)
    .setValue(branchName);

  // H = Return GRV No.
  destinationSheet.getRange(newRow, 8)
    .setValue(returnGrvNo);

  // I = Admin Name
  destinationSheet.getRange(newRow, 9)
    .setValue(adminName);

  // L = Narration
  destinationSheet.getRange(newRow, 12)
    .setValue(narration);


    } else if (
  destinationSheetName === "ABOVE 10 K"
) {

  // A = GRV Date
  destinationSheet.getRange(newRow, 1)
    .setValue(grvDate)
    .setNumberFormat("dd-mmm-yyyy");

  // B = Invoice / Slip No.
  destinationSheet.getRange(newRow, 2)
    .setValue(invoiceNo);

  // C = GRV No.
  destinationSheet.getRange(newRow, 3)
    .setValue(grvNo);

  // E = Supplier Name
  destinationSheet.getRange(newRow, 5)
    .setValue(supplierName);

  // F = Amount
  destinationSheet.getRange(newRow, 6)
    .setValue(amount);

  // G = Branch
  destinationSheet.getRange(newRow, 7)
    .setValue(branchName);

  // H = Return GRV No.
  destinationSheet.getRange(newRow, 8)
    .setValue(returnGrvNo);

  // I = Admin Name
  destinationSheet.getRange(newRow, 9)
    .setValue(adminName);

  // J = Narration
  destinationSheet.getRange(newRow, 10)
    .setValue(narration);

    // Keep new entry text in normal font
      destinationSheet
      .getRange(newRow, 1, 1, 10)
      .setFontWeight("normal");


   } else if (
  destinationSheetName === "Pallets"
) {

  // A = GRV Date
  destinationSheet.getRange(newRow, 1)
    .setValue(grvDate)
    .setNumberFormat("dd-mmm-yyyy");

  // B = Invoice / Slip No.
  destinationSheet.getRange(newRow, 2)
    .setValue(invoiceNo);

  // C = GRV No. not required for Pallet
  destinationSheet.getRange(newRow, 3)
    .clearContent();

  // E = Supplier Name
  destinationSheet.getRange(newRow, 5)
    .setValue(supplierName);

  // F = Amount
  destinationSheet.getRange(newRow, 6)
    .setValue(amount);

  // G = Branch
  destinationSheet.getRange(newRow, 7)
    .setValue(branchName);

  // H = Return GRV No.
  destinationSheet.getRange(newRow, 8)
    .setValue(returnGrvNo);

  // I = Admin Name
  destinationSheet.getRange(newRow, 9)
    .setValue(adminName);

  // J = Pallet Qty
  destinationSheet.getRange(newRow, 10)
    .setValue(palletQty);


  // -----------------------------------------
  // N = AUTOMATIC PALLET NARRATION
  // -----------------------------------------

  var palletNarrationParts = [];

  if (palletQty) {
    palletNarrationParts.push(
      palletQty + " EMPTY PALLETS RETURNED"
    );
  }

  if (returnGrvNo) {
    palletNarrationParts.push(
      "RETURN GRV NO. " + returnGrvNo
    );
  }

  if (invoiceNo) {
    palletNarrationParts.push(
      "SLIP NO. " + invoiceNo
    );
  }

  var palletNarration =
    palletNarrationParts.join(" - ");

  destinationSheet.getRange(newRow, 14)
    .setValue(palletNarration);


  // Keep new entry text in normal font
  destinationSheet
    .getRange(newRow, 1, 1, 14)
    .setFontWeight("normal");
}

    // -----------------------------------------------------
    // SUCCESS
    // -----------------------------------------------------

    return {
      success: true,
      message:
        "New credit note entry saved successfully.",
      destination:
        destinationSheetName,
      row:
        newRow
    };


  } catch (error) {

    throw new Error(
      "NEW ENTRY ERROR:\n\n" +
      error.message
    );
  }

}

/* =========================================================
   GET UNIQUE SUPPLIER NAMES
   ========================================================= */

function getUniqueSupplierNames() {

  try {

    var ss =
      SpreadsheetApp.openById(
        SPREADSHEET_ID
      );

    var sheetNames = [
      "BELOW 3K",
      "3K TO 10 K",
      "ABOVE 10 K",
      "Pallets"
    ];

    var supplierMap = {};

    sheetNames.forEach(function(sheetName) {

      var sheet =
        ss.getSheetByName(sheetName);

      if (!sheet) {
        return;
      }

      var lastRow =
        sheet.getLastRow();

      if (lastRow < 2) {
        return;
      }

      // Supplier Name = Column E
      var values =
        sheet
          .getRange(
            2,
            5,
            lastRow - 1,
            1
          )
          .getDisplayValues();

      values.forEach(function(row) {

        var supplier =
          String(row[0] || "")
            .trim();

        if (!supplier) {
          return;
        }

        /*
         Use upper-case only as the duplicate key.
         Keep the original supplier spelling for display.
        */
        var key =
          supplier.toUpperCase();

        if (!supplierMap[key]) {
          supplierMap[key] = supplier;
        }

      });

    });


    var suppliers =
      Object.keys(supplierMap)
        .map(function(key) {
          return supplierMap[key];
        });


    // Alphabetical sorting
    suppliers.sort(function(a, b) {

      return a.localeCompare(
        b,
        undefined,
        {
          sensitivity: "base"
        }
      );

    });


    return suppliers;


  } catch (error) {

    throw new Error(
      "SUPPLIER LIST ERROR:\n\n" +
      error.message
    );

  }

}

function testMonthlyCleanupPreview() {

  const result =
    getMonthlyCleanupPreview("sree");

  Logger.log(
    JSON.stringify(result, null, 2)
  );
}

function testPermanentMonthlyCleanup() {

  const preview =
    getMonthlyCleanupPreview("sree");

  Logger.log(
    "BEFORE CLEANUP: " +
    JSON.stringify(preview)
  );


  /*
   * SAFETY CHECK
   *
   * For this first controlled test,
   * cleanup will run ONLY when exactly
   * ONE record is waiting.
   */
  if (preview.total !== 1) {

    throw new Error(
      "TEST STOPPED. Expected exactly 1 record waiting for cleanup, but found " +
      preview.total +
      ". Nothing was deleted."
    );
  }


  const result =
    performMonthlyDatabaseCleanup("sree");


  Logger.log(
    "CLEANUP RESULT: " +
    JSON.stringify(result)
  );


  const afterPreview =
    getMonthlyCleanupPreview("sree");


  Logger.log(
    "AFTER CLEANUP: " +
    JSON.stringify(afterPreview)
  );
}

function testPermanentMonthlyCleanup() {

  const preview =
    getMonthlyCleanupPreview("sree");

  Logger.log(
    "BEFORE CLEANUP: " +
    JSON.stringify(preview)
  );


  /*
   * SAFETY CHECK
   *
   * For this first controlled test,
   * cleanup will run ONLY when exactly
   * ONE record is waiting.
   */
  if (preview.total !== 1) {

    throw new Error(
      "TEST STOPPED. Expected exactly 1 record waiting for cleanup, but found " +
      preview.total +
      ". Nothing was deleted."
    );
  }


  const result =
    performMonthlyDatabaseCleanup("sree");


  Logger.log(
    "CLEANUP RESULT: " +
    JSON.stringify(result)
  );


  const afterPreview =
    getMonthlyCleanupPreview("sree");


  Logger.log(
    "AFTER CLEANUP: " +
    JSON.stringify(afterPreview)
  );
}

function testRegion2CreditNotes() {

  const result =
    getCreditNoteRecords(
      "YOUR_TEAM_LEADER_USER_ID",
      "CONSOLIDATED" 
    );

  Logger.log(
    JSON.stringify(result, null, 2)
  );
}

function testRegion2CreditNotes() {

  const result =
    getCreditNoteRecords(
      "amals",
      "CONSOLIDATED"
    );

  Logger.log(
    JSON.stringify(result, null, 2)
  );
}