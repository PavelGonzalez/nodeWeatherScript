// Load Libraries/Modules
const http = require('http');
const sql = require('mssql');

const APPID = '5c0fccea01f9a7634c42d7efaa11fc1e'
const URL = `http://api.openweathermap.org/data/2.5/forecast?lat=11.87&lon=51.42&APPID=${APPID}&units=metric`

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
                console.log(data);
            });
        });
    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
};

// Receive Data and correct its values 
function storeData(data, callback) {
    let correctedData = [];
    for (let list of data) {
        let newitem = correctDataInformation(list);
        correctedData.push(newitem);
    }
    return callback(correctedData);
}

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


/*

    let corrected_density; // Corrected Density of wind
    let exponential; // Exponential
    let HubHeight = 100; // altitude of turbine
    let BasementHeight = 100; // altitud of basement
    let AmbientTemp = 0; // Temperature of ambient // TODO get from APIWEATHER
    let CORR_WIND_SPEED = 0;
    let windspeed = 1; // TODO get from APIWEATHER
    // corrected_density =101325*EXP((-0.034*2*(HubHeight+BasementHeight))/(2*(AmbientTemp+273.15)+0.0065*(HubHeight+BasementHeight)))/(287.058*(AmbientTemp+273.15))

    corrected_density = 101325 * Math.exp((-0.034 * 2 * (HubHeight + BasementHeight)) / (2 * (AmbientTemp + 273.15) + 0.0065 * (HubHeight + BasementHeight))) / (287.058 * (AmbientTemp + 273.15));
    CORR_WIND_SPEED = windspeed * ((corrected_density / 1.225) ^ (1 / 3));
    console.log(corrected_density);
    console.log(CORR_WIND_SPEED);

    /* (async() => {
         const CONFIG = {
             user: 'paveljacobo',
             password: 'Admint5d5',
             server: '195.201.196.135',
             options: {
                 encrypt: true // Use this if you're on Windows Azure
             }
         }
         try {
             await sql.connect(CONFIG);
             const result = await sql.query `SELECT * FROM [dbo].[FORECAST_WIND]`
             console.dir(result)
         } catch (err) {
             console.log('Error', err);
         }
     })()*/


/* INSERT INTO [T-SDS-MAINTAIN].[dbo].[FORECAST_WIND]
           ([TIME_STAMP],[TURBINE_SERIAL],[TURBINE_ID],[AMB_TEMP],[WIND_SPEED],[CORR_WIND_SPEED]
           ,[DEG_WIND],[PRESSURE],[HUMIDITY])
VALUES ('2018-11-11T03:00:00','781464','E-781464',2.3,3.4,3.5,234,12,23)
 */


getDataFromURL();