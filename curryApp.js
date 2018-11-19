const http = require('http');
const sql = require('mssql');
var moment = require('moment');

// Declare constanst and Global variables
// const APPID = '5c0fccea01f9a7634c42d7efaa11fc1e'
const APPID = 'ca83a832b112af61692f71b21d17b423';
var _latitude = '';
var _longitude = '';
var _devices;
var _powercurve;
var infoToSaveInDataBase = [];
var GLOBALCOUNT = 0;
var INSIDEAPI = 0;
var _dataTotal = [];
var _apiInformation = '';
// const CONFIG_CONNECTION = {
//     user: 'paveljacobo',
//     password: 'Admint5d5',
//     server: '195.201.196.135',
//     options: {
//         encrypt: true // Use this if you're on Windows Azure
//     }
// }
const CONFIG_CONNECTION = {
        server: 'localhost',
        user: 'paveljacobo',
        password: 'pavel'
    }
    //  TODO I'LL NEED DEVICE TABLE
    //  TODO I'LL NEED POWERCURVE TABLE
    //  TODO  I'LL NEED INFO FROM API
    //  TODO I'LL COMPOSE DATA
    //  TODO I'LL STORE DATA IN DATABASE

let getTablesIformation = () => {
    console.log('Getting data information from DATABASE SQL , please wait...');
    queryDevices = `SELECT top (10) [TURBINE_SERIAL]
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

    for (let [index, device] of _devices.entries()) {
        latitude = device.TURBINE_LATITUDE;
        longitude = device.TURBINE_LONGITUDE;
        let options = {
            hostname: `api.openweathermap.org`,
            path: `/data/2.5/forecast?lat=${latitude}&lon=${longitude}&APPID=${APPID}&units=metric`
        };
        setTimeout(() => {
            http.get(options, (resp) => {
                let data = '';
                // A chunk of data has been recieved.
                resp.on('data', (dato) => {
                    data += dato;
                });
                // The whole response has been received. Print out the result.
                resp.on('end', () => {
                    GLOBALCOUNT++;
                    console.log(GLOBALCOUNT);
                    _apiInformation = JSON.parse(data);
                    return callback(_apiInformation, device);
                });
            }).on("error", (err) => {
                console.log("Error from calling API: " + err.message);
            });
        }, 4000);

    }
}

getTablesIformation().then(() => {
    console.log('Calling the API Weather for store ForeCast information on DataBase...');

    callApi((dataFromApi, device) => {
        INSIDEAPI++;
        console.log(INSIDEAPI, 'INSIDE API');
        sendDataToCorrect(dataFromApi, device).then(totalInf => {
            _dataTotal.push(totalInf);
            if (_dataTotal.length === _devices.length) {
                _dataTotal = flatten(_dataTotal);
                saveData(_dataTotal);
            }
        }).catch(err => console.log(err));

    });

});

async function sendDataToCorrect(dataFromApi, device) {
    inf = []
    count = 0;
    for (let [index, data] of dataFromApi.list.entries()) {

        const twoDatatoCompare = await correctDataInformation(data, device, index, dataFromApi.list);
        const fadeInf = await createBlindInf(twoDatatoCompare);

        if (fadeInf.length > 0) {
            inf.push(fadeInf);
        }

    }

    return inf;

}

function correctDataInformation(data, device, index, dataFromApi) {



    TwoDataInf = [data, dataFromApi[index + 1]];

    return new Promise((resolve, reject) => {
        twoCorrectedInformation = []
        TwoDataInf.forEach((data) => {


            if (data !== undefined) {

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
                CORR_WIND_SPEED = Math.round(CORR_WIND_SPEED * 100) / 100;


                let power = _powercurve.filter((item) => {
                    return item.Device === device.TURBINE_SERIAL && item.Windspeed === CORR_WIND_SPEED
                });

                let revenues = Math.round((((power[0].Power_Production * device.REVENUES) / 1000) * 1e2) / 1e2);

                newitem = {
                    'dt_txt': moment(data.dt_txt).format('YYYY-MM-DD HH:mm'),
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

                twoCorrectedInformation.push(newitem);

            }

        });
        resolve(twoCorrectedInformation);
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

createBlindInf = (data) => {


    return new Promise((resolve, reject) => {
        createdItems = [];
        if (data.length > 1) {
            secondITEM = {
                'dt_txt': moment(data[0].dt_txt).add(1, 'hour').format('YYYY-MM-DD HH:mm'),
                'AMB_TEMP': data[0].AMB_TEMP + (findValue(data[0].AMB_TEMP, data[1].AMB_TEMP)),
                'WIND_SPEED': data[0].WIND_SPEED + (findValue(data[0].WIND_SPEED, data[1].WIND_SPEED)),
                'CORR_WIND_SPEED': data[0].CORR_WIND_SPEED + (findValue(data[0].CORR_WIND_SPEED, data[1].CORR_WIND_SPEED)),
                'DEG_WIND': data[0].DEG_WIND + (findValue(data[0].DEG_WIND, data[1].DEG_WIND)),
                'PRESSURE': data[0].PRESSURE + (findValue(data[0].PRESSURE, data[1].PRESSURE)),
                'HUMIDITY': data[0].HUMIDITY + (findValue(data[0].HUMIDITY, data[1].HUMIDITY)),
                'POWER': data[0].POWER + (findValue(data[0].POWER, data[1].POWER)),
                'REVENUES': data[0].REVENUES + (findValue(data[0].REVENUES, data[1].REVENUES)),
                'TURBINE_SERIAL': data[0].TURBINE_SERIAL,
                'PARK_NAME': data[0].PARK_NAME
            }
            thirdITEM = {
                'dt_txt': moment(data[0].dt_txt).add(2, 'hour').format('YYYY-MM-DD HH:mm'),
                'AMB_TEMP': data[0].AMB_TEMP + (findValue(data[0].AMB_TEMP, data[1].AMB_TEMP)) * 2,
                'WIND_SPEED': data[0].WIND_SPEED + (findValue(data[0].WIND_SPEED, data[1].WIND_SPEED)) * 2,
                'CORR_WIND_SPEED': data[0].CORR_WIND_SPEED + (findValue(data[0].CORR_WIND_SPEED, data[1].CORR_WIND_SPEED)) * 2,
                'DEG_WIND': data[0].DEG_WIND + (findValue(data[0].DEG_WIND, data[1].DEG_WIND)) * 2,
                'PRESSURE': data[0].PRESSURE + (findValue(data[0].PRESSURE, data[1].PRESSURE)) * 2,
                'HUMIDITY': data[0].HUMIDITY + (findValue(data[0].HUMIDITY, data[1].HUMIDITY)) * 2,
                'POWER': data[0].POWER + (findValue(data[0].POWER, data[1].POWER)) * 2,
                'REVENUES': data[0].REVENUES + (findValue(data[0].REVENUES, data[1].REVENUES)) * 2,
                'TURBINE_SERIAL': data[0].TURBINE_SERIAL,
                'PARK_NAME': data[0].PARK_NAME
            }

            createdItems.push(data[0], secondITEM, thirdITEM);
        }
        resolve(createdItems);
    });

}

let findValue = (valueOne, valueTwo) => {
    let newValue = Number(Math.round(((valueTwo - valueOne) / 3) * 1e2) / 1e2);
    // console.log(newValue);
    return newValue;
}

function flatten(arr) {
    return arr.reduce(function(flat, toFlatten) {
        return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
    }, []);
}

function saveData(data) {
    console.log('guardando los datos...')
        // query = `INSERT INTO [T-SDS-MAINTAIN].[dbo].[FORECAST_WIND]([TIME_STAMP],[TURBINE_SERIAL],[TURBINE_ID],[AMB_TEMP],[WIND_SPEED],[CORR_WIND_SPEED],[DEG_WIND],[PRESSURE],[HUMIDITY],[POWER],[REVENUES])
        //       VALUES `;
        // for (let item of data) {
        //     query += `('${item.dt_txt}',${item.TURBINE_SERIAL},${item.TURBINE_SERIAL},${item.AMB_TEMP},${item.WIND_SPEED},${item.CORR_WIND_SPEED},${item.DEG_WIND},${item.PRESSURE},${item.HUMIDITY}, ${item.POWER}, ${item.REVENUES}),`
        // }


    sql.connect(CONFIG_CONNECTION, err => {
        // ... error checks
        if (err) {
            console.log(err);
        }
        // create the temp table
        let table = new sql.Table('[T-SDS-MAINTAIN].[dbo].[FORECAST_WIND]');
        table.create = true;

        table.columns.add('TIME_STAMP', sql.NVarChar, { nullable: false });
        table.columns.add('TURBINE_SERIAL', sql.NVarChar, { nullable: false });
        table.columns.add('TURBINE_ID', sql.NVarChar, { nullable: false });
        table.columns.add('PARK_NAME', sql.NVarChar, { nullable: true });
        table.columns.add('AMB_TEMP', sql.Numeric(18, 3), { nullable: true });
        table.columns.add('WIND_SPEED', sql.Numeric(18, 3), { nullable: true });
        table.columns.add('CORR_WIND_SPEED', sql.Numeric(18, 3), { nullable: true });
        table.columns.add('DEG_WIND', sql.Numeric(18, 3), { nullable: true });
        table.columns.add('PRESSURE', sql.Numeric(18, 3), { nullable: true });
        table.columns.add('HUMIDITY', sql.Numeric(18, 3), { nullable: true });
        table.columns.add('POWER', sql.Numeric(18, 3), { nullable: true });
        table.columns.add('REVENUES', sql.Numeric(18, 3), { nullable: true });

        for (let item of data) {
            // push some data into the buffer
            table.rows.add(item.dt_txt, item.TURBINE_SERIAL, item.TURBINE_SERIAL, item.PARK_NAME, item.AMB_TEMP, item.WIND_SPEED, item.CORR_WIND_SPEED, item.DEG_WIND, item.PRESSURE, item.HUMIDITY, item.POWER, item.REVENUES);
        }

        const request = new sql.Request()
        request.bulk(table, (err, result) => {
            // ... error checks
            if (err) {
                console.log('ERROR: ', err);
            }
            console.log('Result', result);
            sql.close();
        })


    });

    sql.on('error', err => {
        // ... error handler
        sql.close();
    })

}