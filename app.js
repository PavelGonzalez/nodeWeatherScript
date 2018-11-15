// Load Libraries/Modules
const http = require('http');
const sql = require('mssql');

// Declare constanst and Global variables
const APPID = '5c0fccea01f9a7634c42d7efaa11fc1e'
var latitude = '';
var longitude = '';
var URL = `http://api.openweathermap.org/data/2.5/forecast?`
const CONFIG = {
    user: 'paveljacobo',
    password: 'Admint5d5',
    server: '195.201.196.135',
    options: {
        encrypt: true // Use this if you're on Windows Azure
    }
}

// Get API data
function getDataFromURL(turbines) {

    for (var i = 0; i < turbines.length; i++) {
        latitude = turbines[i].TURBINE_LATITUDE;
        longitude = turbines[i].TURBINE_LONGITUDE;

        let options = {
            hostname: `api.openweathermap.org`,
            path: `/data/2.5/forecast?lat=${latitude}&lon=${longitude}&APPID=${APPID}&units=metric`
        };
        this.turbine = turbines[i];
        //console.log(this.turbine, 'THIS TURBINE');

    }
    http.get(options, (resp) => {
        let data = '';
        // A chunk of data has been recieved.
        resp.on('data', (dato) => {
            data += dato;
        });
        // The whole response has been received. Print out the result.
        resp.on('end', () => {
            let dataInfo = JSON.parse(data);
            storeData(this.turbine, dataInfo.list, (data) => {
                insertIntoTable(data);
            });
        });
    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
};

// Receive Data and send data to function "correctDataInformation" to correct its values 
function storeData(turbine, data, callback) {
    let correctedData = [];
    console.log(turbine, 'Turbine');
    //console.log(data, 'DATA');
    // for (let listdatafromApi of data) {
    //     let newitem = correctDataInformation(turbine, listdatafromApi).then((data) => {
    //         console.log(data, 'FIIIIN');
    //     }).catch(err => console.log(err));
    //     correctedData.push(newitem);
    // }
    // console.log(correctedData);
    // return callback(correctedData);
}

// Receive Data and correct its values 
async function correctDataInformation(turbine, item) {

    var calc = await calculatePower(turbine, item.wind.speed);
    return calc;

    // let corrected_density; // Corrected Density of wind
    // let exponential; // Exponential
    // let hubHeight = turbine.HUB_HEIGHT; // altitude of turbine
    // let basementHeight = turbine.BASEMENT_HEIGHT; // altitud of basement
    // let ambientTemp = item.main.temp; // Temperature of ambient 
    // let CORR_WIND_SPEED;
    // let windspeed = item.wind.speed; // weedspreed from API wather


    // exponential = Math.exp((-0.034 * 2 * (hubHeight + basementHeight)) / (2 * (ambientTemp + 273.15) + 0.0065 * (hubHeight + basementHeight)))
    // corrected_density = 101325 * exponential / (287.058 * (ambientTemp + 273.15));

    // CORR_WIND_SPEED = windspeed * (Math.pow(corrected_density / 1.225, 1 / 3));
    // CORR_WIND_SPEED = Math.round(CORR_WIND_SPEED * 1e2) / 1e2;


    // return newitem = {
    //     'dt_txt': item.dt_txt,
    //     'AMB_TEMP': ambientTemp,
    //     'WIND_SPEED': item.wind.speed,
    //     'CORR_WIND_SPEED': CORR_WIND_SPEED,
    //     'DEG_WIND': item.wind.deg,
    //     'PRESSURE': item.main.pressure,
    //     'HUMIDITY': item.main.humidity,
    //     // 'POWER': power
    // };
}

// Insert modified data into table
function insertIntoTable(data) {

    console.log(data);
    query = `INSERT INTO [T-SDS-MAINTAIN].[dbo].[FORECAST_WIND]([TIME_STAMP],[TURBINE_SERIAL],[TURBINE_ID],[AMB_TEMP],[WIND_SPEED],[CORR_WIND_SPEED],[DEG_WIND],[PRESSURE],[HUMIDITY])
          VALUES `;
    for (let item of data) {
        query += `('${item.dt_txt}',12345,2134,${item.AMB_TEMP},${item.WIND_SPEED},${item.CORR_WIND_SPEED},${item.DEG_WIND},${item.PRESSURE},${item.HUMIDITY}),`
    }

    query = query.slice(0, -1);

    console.log(query);


    (async() => {

        try {
            await sql.connect(CONFIG);
            var request = new sql.Request();
            const result = await request.query(`${query}`);
            console.dir(result);
            sql.close();
        } catch (err) {
            console.log('Error', err);
        }
    })()
}





// Get Info from Out DataBase ForecastWindTable
function getInfFromDB() {
    query = `SELECT TOP (10) [TURBINE_SERIAL]
                ,[TURBINE_LATITUDE]
                ,[TURBINE_LONGITUDE]
                 ,[BASEMENT_HEIGHT]
                ,[HUB_HEIGHT]
                ,[REVENUES]
                 FROM [T-SDS-MAINTAIN].[dbo].[DEVICE]`;
    return new Promise((resolve, reject) => {
        (async() => {

            try {
                await sql.connect(CONFIG);
                var request = new sql.Request();
                const result = await request.query(`${query}`);
                sql.close();
                resolve(result)
            } catch (err) {
                console.log('Error', err);
            }
        })()
    });

}

function calculatePower(turbine, windspeed) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(turbine.TURBINE_SERIAL);
        }, 2000);
    });

    // sql.close();
    // console.log(turbine, windspeed)
    // query = `SELECT [Power_Production]
    //             FROM [T-SDS-MAINTAIN].[dbo].[POWERCURVE]
    //             where DEVICE = '${turbine.TURBINE_SERIAL}' and Windspeed = ${windspeed}`;

    // return new Promise((resolve, reject) => {
    //     (async() => {

    //         try {
    //             await sql.connect(CONFIG);
    //             var request = new sql.Request();
    //             const result = await request.query(`${query}`);
    //             sql.close();
    //             resolve(result)
    //         } catch (err) {
    //             console.log('Error', err);
    //         }
    //     })()
    // });

}

getInfFromDB().then((data) => {
    // console.log(data.recordset, 'Recordset');
    getDataFromURL(data.recordset);

    return;
}).catch((err) => {
    console.log(err);
})


// getDataFromURL();