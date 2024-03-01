import * as websql from './websql.js';
import SQLiteESMFactory from './db-providers/wa-sqlite/wa-sqlite-async.mjs';
import * as WASQLiteAPI from './db-providers/wa-sqlite/wa-sqlite-api.js';

const wait = (t) => {
   console.log(`wait -> ${t} msec`)
   return new Promise((resolve, reject) => {
      setTimeout(() => {
         resolve();
      }, t);
   })
}
const isSecureContext = () => {
    if (navigator.locks) {
      return true;
    } else {
      console.warn('--------------------------------');
      console.warn('You can use this only in secure context. Please see here: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/locks#specifications');
      console.warn('In general you have to use https:// instead http:// and you can use special LOCAL addresses like this: http://localhost, http://127.0.01 and etc.');
      console.warn('BUT you can`t use the local addresses like these: http://192.168.0.1, http://172.128.0.1 and etc.');
      console.warn('Example:  use https://example.com/ instead http://example.com/');
      console.warn('--------------------------------');
      return false;
    }
}

if (isSecureContext()) {
    (async () => {
        const scriptParams = window.websql.getQueryParams(import.meta.url);
        if ('force' in scriptParams) {
            window.websql.forceWebSQLEmulate = scriptParams.force
        }
        if ('debug' in scriptParams) {
            window.websql.debug = scriptParams.debug
        }
        if (typeof(window.openDatabase) === "undefined" || window.websql.forceWebSQLEmulate === true) {
            console.warn(`WebSQL is not supported in this browser !!! (force: ${window.websql.forceWebSQLEmulate})`);
            const module = await SQLiteESMFactory();
            const sqlite3 = WASQLiteAPI.Factory(module);
            window.websql.WebSqlDatabase.initializeDatabaseProvider = (name, version) => {
                return new Promise(async (resolve, reject) => {
                    if (window.websql.WebSqlDatabase.dbs[name] && !window.websql.WebSqlDatabase.dbs[name].db) {
                        if (window.websql.debug) {
                            console.log('WebSql: run wa-sqlite initializeDatabaseProvider')
                        }
                        const vfs = new WASQLiteAPI.IDBBatchAtomicVFS(name);
                        // await wait(100);
                        await vfs.isReady;
                        // await wait(500);
                        sqlite3.vfs_register(vfs, true);
                        // await wait(300)
                        const db = await sqlite3.open_v2(name);
                        // await wait(200);
                        const dbStandarad = {
                            exec: async (sql, args) => {
                                const results = [];
                                for await (const stmt of sqlite3.statements(db, sql)) {
                                    // Bind parameters here if using SQLite placeholders.
                                    sqlite3.bind_collection(stmt, args);

                                    const values = [];
                                    const columns = sqlite3.column_names(stmt);

                                    // Execute the statement with this loop.
                                    while (await sqlite3.step(stmt) === 100) {
                                        // Collect row data here.
                                        // console.log(sqlite3.row(stmt))
                                        values.push(sqlite3.row(stmt))
                                    }

                                    results.push({
                                        columns,
                                        values
                                    })
                                }
                                return results
                            },
                            getRowsModified: () => {
                                return sqlite3.changes(db)
                            },

                        }
                        window.websql.WebSqlDatabase.dbs[name].db = dbStandarad;
                        window.websql.WebSqlDatabase.db = dbStandarad;
                        resolve();
                    } else {
                        window.websql.WebSqlDatabase.db = window.websql.WebSqlDatabase.dbs[name].db;
                        resolve();
                    }
                })
            };
            window.openDatabase = window.websql.WebSqlDatabase.openDatabase;
            window.websql._isReady = true;
        } else {
            window.websql = {
                ready: () => {
                    return new Promise((resolve, reject) => {
                        setTimeout(() => {
                            resolve()
                        }, 100)
                    })
                }
            }
            console.info('Found built-in WebSQL !!!')
        }
    })();
}
