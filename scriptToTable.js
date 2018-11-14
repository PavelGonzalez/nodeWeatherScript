var fs = require('fs');
var arrayOfTurbines = [];
const sql = require('mssql');
var re = /,/gi;
let getdata = new Promise((resolve, reject) => {

    let data = fs.readFileSync('miarchivo.txt', 'utf8')
        .trim()
        .split('\r\n')
        .map(line => line.split('\t'))
        .reduce((turbines, line) => {
            turbines[line[0]] = turbines[line[0]] || []
            let obj = {
                id: line[0],
                latitude_turbine: line[1].replace(re, '.'),
                longitude_turbine: line[2].replace(re, '.'),
                basement_height: line[3].replace(re, '.'),
                hub_height: line[4].replace(re, '.')
            }
            turbines[line[0]].push(obj)
            return turbines;
        }, {});

    resolve(data);

});

getdata.then((data) => {
    insertIntoTable(data);
});



function insertIntoTable(data) {
    console.log('OUTPUT', data);

    // query = `INSERT INTO [T-SDS-MAINTAIN].[dbo].[DEVICE]([TURBINE_SERIAL],[TURBINE_LATITUDE],[TURBINE_LONGITUDE],[BASEMENT_HEIGHT],[HUB_HEIGHT])
    //       VALUES `;

    // for (let item of data) {
    //     query += `('${item.id}', ${item.latitude_turbine}, ${item.longitude_turbine}, ${item.basement_height}, ${item.hub_height}),`
    // }

    // query = query.slice(0, -1);

    // console.log(query);

    // (async() => {
    //     const CONFIG = {
    //         user: 'paveljacobo',
    //         password: 'Admint5d5',
    //         server: '195.201.196.135',
    //         options: {
    //             encrypt: true // Use this if you're on Windows Azure
    //         }
    //     }
    //     try {
    //         await sql.connect(CONFIG);
    //         var request = new sql.Request();
    //         const result = await request.query(`${query}`);
    //         console.dir(result);
    //         sql.close();
    //     } catch (err) {
    //         console.log('Error', err);
    //     }
    // })()
}