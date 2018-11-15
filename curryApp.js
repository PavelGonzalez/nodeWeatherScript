const http = require('http');
const sql = require('mssql');

// Declare constanst and Global variables
const APPID = '5c0fccea01f9a7634c42d7efaa11fc1e'
var latitude = '';
var longitude = '';
var _devices;
var _powercurve;
var infoToSaveInDataBase = [];
var dataTotal = [];
const CONFIG_CONNECTION = {
        user: 'paveljacobo',
        password: 'Admint5d5',
        server: '195.201.196.135',
        options: {
            encrypt: true // Use this if you're on Windows Azure
        }
    }
    //  TODO I'LL NEED DEVICE TABLE
    //  TODO I'LL NEED POWERCURVE TABLE
    //  TODO  I'LL NEED INFO FROM API
    //  TODO I'LL COMPOSE DATA
    //  TODO I'LL STORE DATA IN DATABASE

let getTablesIformation = () => {
    queryDevices = `SELECT TOP (10) [TURBINE_SERIAL]
                        ,[TURBINE_LATITUDE]
                        ,[TURBINE_LONGITUDE]
                        ,[BASEMENT_HEIGHT]
                        ,[HUB_HEIGHT]
                        ,[REVENUES]
                        ,[PARK_NAME]
                         FROM [T-SDS-MAINTAIN].[dbo].[DEVICE]`;
    queryPowerCurve = `SELECT [Device]
                            ,[Model]
                            ,[Windspeed]
                            ,[Power_Production]
                             FROM [T-SDS-MAINTAIN].[dbo].[POWERCURVE]`;

    return new Promise((resolve, reject) => {
        (async() => {

            try {
                await sql.connect(CONFIG_CONNECTION);
                var request = new sql.Request();
                const devicesList = await request.query(`${queryDevices}`);
                const powerTList = await request.query(`${queryPowerCurve}`);
                _devices = devicesList.recordset;
                _powercurve = powerTList.recordset;
                resolve({ _devices, _powercurve });
                sql.close();
            } catch (err) {
                console.log('Error', err);
            }
        })()
    })

}

callApi = (callback) => {
    for (let device of _devices) {
        latitude = device.TURBINE_LATITUDE;
        longitude = device.TURBINE_LONGITUDE;
        let options = {
            hostname: `api.openweathermap.org`,
            path: `/data/2.5/forecast?lat=${latitude}&lon=${longitude}&APPID=${APPID}&units=metric`
        };
        http.get(options, (resp) => {
            let data = '';
            // A chunk of data has been recieved.
            resp.on('data', (dato) => {
                data += dato;
            });
            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                let dataInfo = JSON.parse(data);
                return callback(dataInfo, device);
            });
        }).on("error", (err) => {
            console.log("Error: " + err.message);
        });
    }
}

getTablesIformation().then(() => {

    callApi((dataFromApi, device) => {
        //console.log('CALL');
        sendDataToCorrect(dataFromApi, device).then(totalInf => {
            // saveData(totalInf);
            dataTotal.push(totalInf);
            if (dataTotal.length === _devices.length) {
                saveData(dataTotal);
            }
        });
    });


});

async function sendDataToCorrect(dataFromApi, device) {
    inf = []
    for (let data of dataFromApi.list) {

        const a = await correctDataInformation(data, device);
        inf.push(a);
    }

    return inf;

}

function correctDataInformation(data, device) {

    return new Promise((resolve, reject) => {

        let corrected_density; // Corrected Density of wind
        let exponential; // Exponential
        let hubHeight = device.HUB_HEIGHT; // altitude of device
        let basementHeight = device.BASEMENT_HEIGHT; // altitud of basement
        let ambientTemp = data.main.temp; // Temperature of ambient 
        let CORR_WIND_SPEED;
        let windspeed = data.wind.speed; // weedspreed from API wather


        exponential = Math.exp((-0.034 * 2 * (hubHeight + basementHeight)) / (2 * (ambientTemp + 273.15) + 0.0065 * (hubHeight + basementHeight)))
        corrected_density = 101325 * exponential / (287.058 * (ambientTemp + 273.15));

        CORR_WIND_SPEED = windspeed * (Math.pow(corrected_density / 1.225, 1 / 3));
        CORR_WIND_SPEED = Math.round(CORR_WIND_SPEED * 1e2) / 1e2;


        let power = _powercurve.filter((item) => {
            return item.Device === device.TURBINE_SERIAL && item.Windspeed === CORR_WIND_SPEED
        });

        let revenues = (power[0].Power_Production * device.REVENUES) / 1000;




        newitem = {
            'dt_txt': data.dt_txt,
            'AMB_TEMP': ambientTemp,
            'WIND_SPEED': data.wind.speed,
            'CORR_WIND_SPEED': CORR_WIND_SPEED,
            'DEG_WIND': data.wind.deg,
            'PRESSURE': data.main.pressure,
            'HUMIDITY': data.main.humidity,
            'POWER': power[0].Power_Production,
            'REVENUES': revenues,
            'TURBINE_SERIAL': device.TURBINE_SERIAL,
            'PARK_NAME': device.PARK_NAME
        };


        resolve(newitem);


    });
}


// Insert modified data into table
function insertIntoTable(data) {

    console.log(data);
    query = `INSERT INTO [T-SDS-MAINTAIN].[dbo].[FORECAST_WIND]([TIME_STAMP],[TURBINE_SERIAL],[TURBINE_ID],[AMB_TEMP],[WIND_SPEED],[CORR_WIND_SPEED],[DEG_WIND],[PRESSURE],[HUMIDITY], [POWER],[REVENUES])
          VALUES `;
    for (let item of data) {
        query += `('${item.dt_txt}',${item.TURBINE_SERIAL},${item.TURBINE_SERIAL},${item.AMB_TEMP},${item.WIND_SPEED},${item.CORR_WIND_SPEED},${item.DEG_WIND},${item.PRESSURE},${item.HUMIDITY}, ${item.POWER}, ${item.REVENUES}),`
    }

    query = query.slice(0, -1);

    console.log(query);


    // (async() => {

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

function saveData(data) {
    console.log(data);
}