// Load Libraries/Modules
const http = require('http');
const sql = require('mssql');

// Declare constanst and Global variables
const APPID = '5c0fccea01f9a7634c42d7efaa11fc1e'
var latitude = '';
var longitude = '';
const URL = `http://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&APPID=${APPID}&units=metric`
const CONFIG = {
    user: 'paveljacobo',
    password: 'Admint5d5',
    server: '195.201.196.135',
    options: {
        encrypt: true // Use this if you're on Windows Azure
    }
}

// Get API data
function getDataFromURL() {
    http.get(URL, (resp) => {
        let data = '';
        // A chunk of data has been recieved.
        resp.on('data', (dato) => {
            data += dato;
        });
        // The whole response has been received. Print out the result.
        resp.on('end', () => {
            let dataInfo = JSON.parse(data);
            storeData(dataInfo.list, (data) => {
                insertIntoTable(data);
            });
        });
    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
};

// Receive Data and send data to function "correctDataInformation" to correct its values 
function storeData(data, callback) {
    let correctedData = [];
    for (let list of data) {
        let newitem = correctDataInformation(list);
        correctedData.push(newitem);
    }
    return callback(correctedData);
}

// Receive Data and correct its values 
function correctDataInformation(item) {

    let corrected_density; // Corrected Density of wind
    let exponential; // Exponential
    let HubHeight = 32; // altitude of turbine
    let BasementHeight = 100; // altitud of basement
    let AmbientTemp = item.main.temp; // Temperature of ambient // TODO get from APIWEATHER
    let CORR_WIND_SPEED;
    let windspeed = item.wind.speed; // TODO get from APIWEATHER


    exponential = Math.exp((-0.034 * 2 * (HubHeight + BasementHeight)) / (2 * (AmbientTemp + 273.15) + 0.0065 * (HubHeight + BasementHeight)))
    corrected_density = 101325 * exponential / (287.058 * (AmbientTemp + 273.15));

    CORR_WIND_SPEED = windspeed * (Math.pow(corrected_density / 1.225, 1 / 3));

    return newitem = {
        'dt_txt': item.dt_txt,
        'AMB_TEMP': AmbientTemp,
        'WIND_SPEED': item.wind.speed,
        'CORR_WIND_SPEED': CORR_WIND_SPEED,
        'DEG_WIND': item.wind.deg,
        'PRESSURE': item.main.pressure,
        'HUMIDITY': item.main.humidity
    };
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
                resolve(result)
                sql.close();
            } catch (err) {
                console.log('Error', err);
            }
        })()
    });

}

getInfFromDB().then((data) => {
    console.log(data);

})

// getDataFromURL();