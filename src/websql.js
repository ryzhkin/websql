class AsyncQueue {
    constructor() {
        this.promiseChain = Promise.resolve();
    }

    async enqueue(task, ...args) {
        this.promiseChain = this.promiseChain.then(() => task(...args));
        return this.promiseChain;
    }
}

const execQueue = new AsyncQueue();

class DatabaseCallback {

    constructor(callback) {
        this.callback = callback;
    }

    handleEvent(database) {
        this.callback(database);
    }

}

class SQLTransactionCallback {

    constructor(callback) {
        this.callback = callback;
    }

    handleEvent(transaction) {
        this.callback(transaction);
    }

}

class SQLStatementCallback {

    constructor(callback) {
        this.callback = callback;
    }

    handleEvent(transaction, result) {
        this.callback(transaction, result);
    }

}

class SQLError {
    static UNKNOWN_ERR = 0;
    static DATABASE_ERR = 1;
    static VERSION_ERR = 2;
    static TOO_LARGE_ERR = 3;
    static QUOTA_ERR = 4;
    static SYNTAX_ERR = 5;
    static CONSTRAINT_ERR = 6;
    static TIMEOUT_ERR = 7;

    static errorMessages = {
        0: 'The transaction failed for reasons unrelated to the database itself and not covered by any other error code.',
        1: 'The statement failed for database reasons not covered by any other error code.',
        2: 'The operation failed because the actual database version was not what it should be.',
        3: 'The statement failed because the data returned from the database was too large.',
        4: 'The statement failed because there was not enough remaining storage space, or the storage quota was reached and the user declined to give more space to the database.',
        5: 'The statement failed because of a syntax error, or the number of arguments did not match the number of ? placeholders in the statement, or the statement tried to use a statement that is not allowed',
        6: 'An INSERT, UPDATE, or REPLACE statement failed due to a constraint failure.',
        7: 'A lock for the transaction could not be obtained in a reasonable time.',
    };

    constructor(errorCode, errorMessage) {
        this.code = errorCode;
        if (errorMessage) {
            this.message = errorMessage;
        } else {
            this.message = (SQLError.errorMessages[errorCode])?SQLError.errorMessages[errorCode]:'Unknown error message';
        }
    }
}

class SQLResultSetRowList extends Array {
    item(index) {
        return this[index];
    }
}

class SQLResultSet {
    constructor(result) {
        this.insertId = result.insertId;
        this.rowsAffected = result.rowsAffected;
        this.rows = new SQLResultSetRowList();
        this.sql = result.sql;
        this.args = result.args;

        for (let r = 0; r < result.rows.values.length; r++) {
            let row = {}
            for (let c = 0; c < result.rows.columns.length; c++) {
                row[result.rows.columns[c]] = result.rows.values[r][c];
            }
            this.rows[r] = row;
        }
    }
}

class SQLTransaction {

    constructor(db) {
        this.db = db;
        this.error = null;
    }

    async start() {
        await this.db.exec('BEGIN TRANSACTION;');
    }

    async commit() {
        await this.db.exec('COMMIT;');
    }

    async rollback() {
        await this.db.exec('ROLLBACK;');
    }

    containsInsertOrUpdateOrDelete(str) {
        const regex = /insert|update|delete/i;
        return regex.test(str);
    }

    containsInsert(str) {
        const regex = /insert/i;
        return regex.test(str);
    }

    prepareSQL(sql) {
        return replaceForQuotedStrings(sql);
    }

    async executeSqlAsync(sql, args,  callback, errorCallback) {
        sql = this.prepareSQL(sql);
        let result = null;
        try {
            let insertId = 0;
            let rowsAffected = 0;
            let rows = [];
            let r = await this.db.exec(sql, args);
            if (r && r.length > 0 && typeof(r[0].values) !== "undefined" && typeof(r[0].columns) !== "undefined") {
                rows = r[0]
            }
            if (this.containsInsertOrUpdateOrDelete(sql)) {
                rowsAffected = this.db.getRowsModified();
                if (this.containsInsert(sql)) {
                    const last_insert_rowid = await this.db.exec('SELECT last_insert_rowid()')
                    insertId = last_insert_rowid[0].values[0][0];
                }
            }
            result = new SQLResultSet({
                insertId: insertId,
                rowsAffected: rowsAffected,
                rows: rows,
                sql: sql,
                args: args
            });

            if (websql.debug) {
               console.log('result ---> ', result)
            }

            if (result !== null) {
                if (typeof (callback) === "function") {
                    callback(this, result)
                }
            }
        } catch (e) {
            if (websql.debug) {
                console.log('error from sql: ', sql)
                console.log('catch error in executeSqlAsync: ', typeof (e), e)
            }
            let error = new SQLError(SQLError.SYNTAX_ERR, e.toString());
            if (typeof (errorCallback) === "function") {
                let errorCallbackResult;
                try {
                    errorCallbackResult = errorCallback(this, error);
                } catch (errorCallbackError) {
                    errorCallbackResult = true;
                }
                if (errorCallbackResult) {
                    this.error = new SQLError(SQLError.UNKNOWN_ERR, 'the statement callback raised an exception or statement error callback did not return false');
                }
            } else {
              this.error = error;
            }
        }
    }

    executeSql(sql, args, callback, errorCallback) {
        execQueue.enqueue(this.executeSqlAsync.bind(this), sql, args, callback, errorCallback);
    }

}

class WebSqlDatabase {
    static db = null;
    static dbs = {};

    constructor(name, version) {
        this.name = name;
        this.version = version;
        if (!WebSqlDatabase.dbs[this.name]) {
            WebSqlDatabase.dbs[this.name] = {
                name: this.name,
                version: this.version,
                locked: false // false|true for write/update DB operations
            }
        }
    }

    static getAllWebSqlDbConfigurations = () => {
        let configs = localStorage.getItem('WebSQLdbConfigs');
        return configs ? JSON.parse(configs) : {};
    }

    static updateWebSqlDbConfiguration = (configName, updates) => {
        let configs = WebSqlDatabase.getAllWebSqlDbConfigurations();
        if (configs[configName]) {
            configs[configName] = {...configs[configName], ...updates};
        } else {
            configs[configName] = updates
        }
        localStorage.setItem('WebSQLdbConfigs', JSON.stringify(configs));
    }

    static initializeDatabaseProvider(name, version) {
        if (websql.debug) {
           console.log('run original initializeDatabaseProvider');
        }
        return new Promise((resolve, reject) => {
            resolve();
        })
    }

    async execTransaction(callback, errorCallback, successCallback) {
        if (typeof(callback) !== "function") {
            throw new SQLError(SQLError.UNKNOWN_ERR)
        }

        await WebSqlDatabase.initializeDatabaseProvider(this.name, this.version);
        const tx = new SQLTransaction(WebSqlDatabase.db);
        try {
            execQueue.enqueue(async () => {
                if (websql.debug) {
                   console.log('[execTransaction] - START')
                }
                await tx.start();
            })

            await callback(tx);

            execQueue.enqueue(async () => {
                if (tx.error !== null) {
                    // throw tx.error
                    if (websql.debug) {
                       console.log('catch error in transaction: ', typeof (tx.error), tx.error)
                    }

                    // Roolback the current transaction
                    await tx.rollback();

                    if (typeof (errorCallback) === "function") {
                        errorCallback(tx.error)
                    } else {
                        // throw tx.error;
                    }
                } else {
                  await tx.commit();
                  if (typeof (successCallback) === "function") {
                     successCallback();
                  }
                }
                if (websql.debug) {
                    console.log('[execTransaction] - END')
                }
            })
        } catch (e) {
            if (websql.debug) {
               console.log('catch error in transaction: ', typeof (e), e)
            }

            // Roolback the current transaction
            await tx.rollback();

            if (typeof (errorCallback) === "function") {
                errorCallback(e)
            } else {
                throw e;
            }
        } finally {

        }

    }

    transaction(callback, errorCallback, successCallback) {
        execQueue.enqueue(this.execTransaction.bind(this), callback, errorCallback, successCallback);
    }

    readTransaction(callback, errorCallback, successCallback) {
        // similar to transaction(), read-only
        this.transaction(callback, errorCallback, successCallback);
    }

    changeVersion(oldVersion, newVersion, callback, errorCallback, successCallback) {
        if(this.version !== oldVersion) {
            errorCallback(new SQLError(SQLError.VERSION_ERR));
            return;
        }

        // ToDo: Nothing to do
        // sqljs.changeVersion(this.name, newVersion);

        this.version = newVersion;

        // ToDo: Update version in Db - not supported by sql.js
        // let transaction = sqljs.createTransaction(this.name);
        // transaction.executeSql('UPDATE SCHEMA QUERY');
        // transaction.commit();

        if(callback) callback();
        if(successCallback) successCallback();

    }

    static openDatabase(name, version, displayname, size, callback) {
        WebSqlDatabase.updateWebSqlDbConfiguration(name, {name, version, displayname, size})
        const db = new WebSqlDatabase(name, version);
        if (typeof(callback) === "function") {
            callback(db);
        }
        return db;
    }
}

function removeSubstringIncludingBounds(str, start, end) {
    start = Math.max(start, 0);
    end = Math.min(end, str.length - 1);
    return str.slice(0, start) + str.slice(end + 1);
}
function escapeSingleQuotes(str, start, end) {
    start = Math.max(start, 0);
    end = Math.min(end, str.length);
    const middle = str.slice(start, end + 1);
    const count = (middle.match(/'/g) || []).length;
    const escapedMiddle = middle.replace(/'/g, "''");
    const resultStr = str.slice(0, start) + escapedMiddle + str.slice(end + 1);
    return {
        resultStr,
        count
    };
}
function extractSubstringsWithPositions(str) {
    const regex = /'([^']*(?:''[^']*)*)'|"([^"]*(?:""[^"]*)*)"/g;
    let matches;
    const substrings = [];
    while ((matches = regex.exec(str)) !== null) {
        const match = matches[1] || matches[2];
        const cleaned = match.replace(/''/g, "'").replace(/""/g, '"');
        substrings.push({
            'substring': cleaned,
            'start': matches.index,
            'end': matches.index + match.length + 1
        });
    }
    return substrings;
}
function setCharAt(str, index, chr) {
    if(index > str.length - 1) return str;
    return str.substring(0, index) + chr + str.substring(index + 1);
}
function replaceForQuotedStrings(sql) {
    const strings = extractSubstringsWithPositions(sql)
    let offset = 0;
    for (let string of strings) {
        sql = setCharAt(sql, string.start + offset, "'")
        sql = setCharAt(sql, string.end + offset, "'")
        let res = escapeSingleQuotes(sql, string.start + offset + 1, string.end + offset - 1)
        offset += res.count
        sql = res.resultStr
    }
    sql = sql.replace(/""/g, '"');
    return sql;
}

function toBoolean(str) {
    if (typeof str !== 'string') {
        return str;
    }

    switch (str.trim().toLowerCase()) {
        case 'true':
        case 'yes':
        case '1':
            return true;
        case 'false':
        case 'no':
        case '0':
        case null:
            return false;
        default:
            return str;
    }
}
function getQueryParams(scriptSrc) {
    const params = {};
    const queryString = scriptSrc.split('?')[1];
    if (queryString) {
        const pairs = queryString.split('&');
        for (let pair of pairs) {
            const [key, value] = pair.split('=');
            params[decodeURIComponent(key)] = toBoolean(decodeURIComponent(value || ''));
        }
    }
    return params;
}
function ready() {
  return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
          if (window.websql._isReady) {
              resolve();
          } else if (Date.now() - startTime > 10000) {
              reject(new Error("Timeout reached"));
          } else {
              setTimeout(check, 100);
          }
      };
      check();
  })
}


const websql = {
    _isReady: false,
    debug: false,
    forceWebSQLEmulate: false,
    getQueryParams,
    ready,

    DatabaseCallback,
    SQLTransactionCallback,
    SQLStatementCallback,
    SQLError,
    SQLResultSetRowList,
    SQLResultSet,
    SQLTransaction,
    WebSqlDatabase,
}

window.websql = websql

