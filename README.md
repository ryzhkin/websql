# WebSQL Legacy Support Library

This project was conceived in response to the deprecation of the WebSQL standard in newer versions of Chrome, as
outlined in [Chrome's official announcement](https://developer.chrome.com/blog/deprecating-web-sql?hl=en). Recognizing
the extensive amount of legacy code that relies on WebSQL, and the economic impracticality of rewriting such codebases,
this implementation offers a solution. It allows legacy code to operate unchanged in new Chrome versions, ensuring
continuity and stability for existing web applications reliant on WebSQL.

## Usage Instructions

1. Download the `src/` folder containing the library and place it within your project structure.
2. Include the library in your project using one of the following methods:

### Method 1: In-Memory Mode

```html
<script src="src/websql-memory.js?force=true&debug=false"></script>
```

This method loads the library in an in-memory mode, offering rapid performance with the trade-off that data is not
preserved between page reloads. Suitable for projects where persistent data storage is not required.


### Method 2: Persistent Storage Mode

```html
<script type="module" src="src/websql-persistent.js?force=true&debug=false"></script>
```

This approach is slower but saves data between page reloads, making it suitable for most legacy projects that utilize
WebSQL.

- `force=true/false`: If set to `true`, forces the use of this library even when WebSQL is supported by the browser.
  Otherwise, the library is only utilized if WebSQL is unavailable.
- `debug=true/false`: Toggles the output of extended debugging information in the browser's console, aiding in a deeper
  understanding of the processes involved.

## Automatic Registration and Full WebSQL API Support

Once added to your page, the library automatically registers itself and supports the full WebSQL
API https://www.w3.org/TR/webdatabase/ . This ensures that your legacy code will function as usual without any
modifications.

### Simple Examples of WebSQL Usage

Below are a few straightforward examples to illustrate the use of WebSQL:

1. **Creating a Database:**
   ```javascript
   var db = openDatabase('mydb', '1.0', 'Test DB', 2 * 1024 * 1024);

2. **Creating a Table:**
   ```javascript
   db.transaction(function (tx) {
       tx.executeSql('CREATE TABLE IF NOT EXISTS LOGS (id unique, log)');
   });

3. **Inserting Data:**
   ```javascript
   db.transaction(function (tx) {
      tx.executeSql('INSERT INTO LOGS (id, log) VALUES (1, "Sample log")');
   });

4. **Querying Data:**
   ```javascript
   db.transaction(function (tx) {
      tx.executeSql('SELECT * FROM LOGS', [], function (tx, results) {
         var len = results.rows.length, i;
         for (i = 0; i < len; i++) {
           console.log(results.rows.item(i).log);
         }
      }, null);
   });
