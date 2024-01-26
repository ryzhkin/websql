let relativePath = '';
const currentScriptURL = document.currentScript.src;
const scriptUrl = new URL(currentScriptURL);
const hostname = scriptUrl.hostname;
const pathname = scriptUrl.pathname;
relativePath = pathname.replace(`/${hostname}`, '');
relativePath = relativePath.substring(0, relativePath.lastIndexOf('/') + 1);

window.websql = {
    ready: () => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve()
            }, 100)
        })
    }
}

;(async () => {
    window.loadExternalScript = function (url) {
        return new Promise((resolve, reject) => {
            var script = document.createElement('script');
            script.src = url;
            script.onload = () => resolve(script);
            script.onerror = () => reject(new Error(`Script load error for ${url}`));
            document.head.appendChild(script);
        });
    }
    try {
        await loadExternalScript(`${relativePath}websql.js`);
        const scriptParams = window.websql.getQueryParams(currentScriptURL);
        if ('force' in scriptParams) {
           window.websql.forceWebSQLEmulate = scriptParams.force
        }
        if ('debug' in scriptParams) {
            window.websql.debug = scriptParams.debug
        }
        if (typeof(window.openDatabase) === "undefined" || window.websql.forceWebSQLEmulate === true) {
            console.warn(`WebSQL is not supported in this browser !!! (force: ${window.websql.forceWebSQLEmulate})`);
            if (typeof(initSqlJs) === "undefined") {
                await loadExternalScript(`${relativePath}db-providers/sqli-js/sql-wasm.js`);
            }
            console.warn('Try loading the WebSQL emulator instead !!!');
            WebSqlDatabase.initializeDatabaseProvider = (name, version) => {
                return new Promise((resolve, reject) => {
                    if (WebSqlDatabase.db === null) {
                        if (window.websql.debug) {
                            console.log('run SQLI-JS initializeDatabaseProvider');
                        }
                        initSqlJs({
                            locateFile: file => `${relativePath}db-providers/sqli-js/${file}`
                        }).then((SQL) => {
                            WebSqlDatabase.db = new SQL.Database();
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                })
            }
            window.openDatabase = WebSqlDatabase.openDatabase;
            window.websql._isReady = true;
        } else {
            console.info('Found built-in WebSQL !!!')
        }
    } catch (error) {
        console.error('Error:', error);
    }
})(window);
