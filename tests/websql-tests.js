describe('WebSQL API', function() {

    it('openDatabase creates a database', () => {
        const db = openDatabase('mydb', '1.0', 'Test DB', 1024 * 1024);
        expect(db).toBeDefined();
        expect(db.version).toBe('1.0');
    });

    it('version returns the current version', () => {
        const db = openDatabase('mydb', '1.0', 'Test DB', 1024 * 1024);
        expect(db.version).toBe('1.0');
    });

    // it('openDatabase throws an exception if the database already exists with a different version', () => {
    //     expect(() => {
    //         openDatabase('mydb', '2.0', 'Test DB', 1024 * 1024);
    //     }).toThrowError();
    // });

    it('DEBUG -> ASYNC transactions', (done) => {
        const db = openDatabase('mydb', '1.0', 'Test DB', 1024 * 1024);
        db.transaction((tx) => {
            tx.executeSql('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, text)');
            tx.executeSql('INSERT INTO test (text) VALUES (?)', ['test']);
            tx.executeSql('SELECT * FROM test', [], (tx, result) => {
                //expect(result.rows.length).toBe(1);
                expect(result.rows.item(0).text).toBe('test');
                done();
            });
            tx.executeSql('SELECT * FROM test WHERE id <= 10')
            tx.executeSql('SELECT datetime(\'now\');')
            tx.executeSql('SELECT 777;')
        });
        db.transaction((tx) => {
            tx.executeSql('INSERT INTO test (text) VALUES (?)', ['test']);
            tx.executeSql('SELECT 888;')
        });
    });

    it('transaction executes a transaction', (done) => {
        const db = openDatabase('mydb', '1.0', 'Test DB', 1024 * 1024);
        db.transaction((tx) => {
            tx.executeSql('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, text)');
            done();
        });
    });

    it('readTransaction reads data', (done) => {
        const db = openDatabase('mydb', '1.0', 'Test DB', 1024 * 1024);
        db.transaction( (tx) => {
            tx.executeSql('INSERT INTO test (text) VALUES (?)', ['test']);
        });
        db.readTransaction((tx) => {
            tx.executeSql('SELECT * FROM test', [], (tx, result) => {
                expect(result.rows.item(0).text).toBe('test');
                done();
            });
        });
    });

    it('transaction errors are handled by the error handler', (done) => {
        const db = openDatabase('mydb', '1.0', 'Test DB', 1024 * 1024);
        db.transaction((tx) => {
            tx.executeSql('INVALID SQL');
        }, (error) => {
            expect(error.code).toBe(5);
            done();
        });
    });

    it('should handle errors', (done) => {
        var db = openDatabase('testdb', '1.0', 'Test DB', 2 * 1024 * 1024);
        db.transaction((tx) => {
            tx.executeSql('INSERT INTO non_existing_table (data) VALUES (?)', ['test'], null, (tx, error) => {
                expect(error).not.toBeNull();
                done();
            });
        });
    });

    it('The transaction is running asynchronously', (done) => {
        const db = openDatabase('mydb', '1.0', 'Test DB', 1024 * 1024);

        let flag = false;

        db.transaction((tx) => {
            tx.executeSql('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, text)');
            flag = true;
        });

        setTimeout(() => {
            expect(flag).toBe(true);
            done();
        }, 100);

    });

    it('query results are returned via colbacks', (done) => {
        const db = openDatabase('mydb', '1.0', 'Test DB', 1024 * 1024);
        db.transaction((tx) => {
            tx.executeSql('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, text)');
            tx.executeSql('INSERT INTO test (text) VALUES (?)', ['test'], (tx, result) => {
                expect(result.insertId).toBeDefined();
                expect(result.rowsAffected).toBe(1);
                done();
            });
        });
    });

    it('SQLResultSet object is returned', (done) => {
        const db = openDatabase('mydb', '1.0', 'Test DB', 1024 * 1024);
        db.readTransaction((tx) => {
            tx.executeSql('SELECT * FROM test', [], (tx, result) => {
                expect(result).toBeDefined();
                expect(result.rowsAffected).toBeDefined();
                expect(result.rows).toBeDefined();
                done();
            });
        });
    });

    it('should create a table', (done) => {
        const db = openDatabase('testdb', '1.0', 'Test DB', 2 * 1024 * 1024);
        db.transaction((tx) => {
            tx.executeSql('CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, data TEXT)', [], () => {
                done();
            });
        });
    });

    it('should insert data into the table', (done) => {
        const db = openDatabase('testdb', '1.0', 'Test DB', 2 * 1024 * 1024);
        db.transaction((tx) => {
            tx.executeSql('DELETE FROM test_table');
            tx.executeSql('INSERT INTO test_table (data) VALUES (?)', ['test']);
            tx.executeSql('SELECT * FROM test_table', [], (tx, results) => {
                expect(results.rows.item(0).data).toEqual('test');
                done();
            });
        });
    });

    it('should update data in the table', (done) => {
        const db = openDatabase('testdb', '1.0', 'Test DB', 2 * 1024 * 1024);
        db.transaction((tx) => {
            tx.executeSql('UPDATE test_table SET data = ? WHERE id = ?', ['updated', 1]);
            tx.executeSql('SELECT * FROM test_table WHERE id = ?', [1], (tx, results) => {
                expect(results.rows.item(0).data).toEqual('updated');
                done();
            });
        });
    });

    it('should delete data from the table', (done) => {
        const db = openDatabase('testdb', '1.0', 'Test DB', 2 * 1024 * 1024);
        db.transaction((tx) => {
            tx.executeSql('DELETE FROM test_table WHERE id = ?', [1]);
            tx.executeSql('SELECT * FROM test_table', [], (tx, results) => {
                expect(results.rows.length).toEqual(0);
                done();
            });
        });
    });

    it('should handle multiple transactions', (done) => {
        const db = openDatabase('testdb', '1.0', 'Test DB', 2 * 1024 * 1024);
        db.transaction((tx) => {
            tx.executeSql('INSERT INTO test_table (data) VALUES (?)', ['data1']);
        });
        db.transaction((tx) => {
            tx.executeSql('INSERT INTO test_table (data) VALUES (?)', ['data2']);
        }, null, () => {
            db.transaction((tx) => {
                tx.executeSql('SELECT * FROM test_table', [], (tx, results) => {
                    expect(results.rows.length).toEqual(2);
                    done();
                });
            });
        });
    });

    it('should handle SQL errors', (done) => {
        const db = openDatabase('testdb', '1.0', 'Test DB', 2 * 1024 * 1024);
        db.transaction((tx) => {
            tx.executeSql('INSERT INTO non_existing_table (data) VALUES (?)', ['test'], null, (error) => {
                expect(error).not.toBeNull();
                done();
            });
        });
    });

    it('should enforce database constraints', function(done) {
        const db = openDatabase('testdb', '1.0', 'Test DB', 2 * 1024 * 1024);
        db.transaction((tx) => {
            tx.executeSql('CREATE TABLE IF NOT EXISTS unique_test_table (id INTEGER PRIMARY KEY, data TEXT UNIQUE)');
            tx.executeSql('DELETE FROM unique_test_table');
            tx.executeSql('INSERT INTO unique_test_table (id, data) VALUES (?, ?)', [1, 'uniqueData']);
            tx.executeSql('INSERT INTO unique_test_table (id, data) VALUES (?, ?)', [2, 'uniqueData'], null, (tx, error) => {
                expect(error).not.toBeNull();
                done();
            });
        });
    });

    it('should perform well with large data sets', (done) => {
        const db = openDatabase('testdb', '1.0', 'Test DB', 2 * 1024 * 1024);
        var largeDataSet = new Array(10000).fill('testData');
        db.transaction((tx) => {
            tx.executeSql('DELETE FROM test_table');
            largeDataSet.forEach((data, index) => {
                tx.executeSql('INSERT INTO test_table (data) VALUES (?)', [data]);
            });
        }, null, () => {
            db.transaction((tx) => {
                tx.executeSql('SELECT COUNT(*) AS count FROM test_table', [], (tx, results) => {
                    expect(results.rows.item(0).count).toEqual(10000);
                    done();
                });
            });
        });
    });

    it('should select the current datetime using different syntaxes', (done) => {
        const db = openDatabase('mydb', '1.0', 'Test DB', 2 * 1024 * 1024);
        db.transaction((tx) => {
            tx.executeSql("select datetime('now');", [], (tx, res) => {
                expect(res).toBeDefined();
                expect(res.rows).toBeDefined();
                expect(res.rows.length).toBe(1);
            });
            tx.executeSql("select datetime(\"now\");", [], (tx, res) => {
                expect(res).toBeDefined();
                expect(res.rows).toBeDefined();
                expect(res.rows.length).toBe(1);
            });
        }, null, () => {
            done();
        });
    });

    it('should insert and select JSON data', (done) => {
        const db = openDatabase('mydb', '1.0', 'Test DB', 2 * 1024 * 1024);
        db.transaction((tx) => {
            tx.executeSql('DROP TABLE IF EXISTS test_json');
            tx.executeSql(`
            CREATE TABLE test_json (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT,
              json_data JSON
            );`);

            tx.executeSql(`
            INSERT INTO test_json (name, json_data)
            VALUES ('Example Name', '{"key": "value", "array": [1, 2, 3]}');
            `, [], (tx, res) => {
                expect(res).toBeDefined();
                expect(res.rowsAffected).toBeDefined();
                expect(res.rowsAffected).toBe(1);
            });

            tx.executeSql(`SELECT * FROM test_json WHERE name = "Example Name";`,
                [], (tx, res) => {
                expect(res).toBeDefined();
                expect(res.rows).toBeDefined();
                expect(res.rows.item(0).json_data).toBe('{"key": "value", "array": [1, 2, 3]}');
                expect(JSON.parse(res.rows.item(0).json_data)['array']).toEqual([1, 2, 3]);
            });

            tx.executeSql(`
            INSERT INTO test_json (name, json_data)
            VALUES ("example2", "{""p1"": 777, ""p2"": ""test's""}");
            `, [], (tx, res) => {
                expect(res).toBeDefined();
                expect(res.rowsAffected).toBeDefined();
                expect(res.rowsAffected).toBe(1);
            });

            tx.executeSql(`SELECT * FROM test_json WHERE name = "example2";`,
                [], (tx, res) => {
                    expect(res).toBeDefined();
                    expect(res.rows).toBeDefined();
                    expect(res.rows.item(0).json_data).toBe('{"p1": 777, "p2": "test\'s"}');
                    expect(JSON.parse(res.rows.item(0).json_data)['p1']).toEqual(777);
                    expect(JSON.parse(res.rows.item(0).json_data)['p2']).toEqual("test's");
            });


        }, null, () => {
            done();
        });
    });

})



