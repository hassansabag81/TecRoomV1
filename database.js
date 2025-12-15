const oracledb = require('oracledb');
require('dotenv').config();

oracledb.initOracleClient({
    //Aqui pon la ruta donde tienes la carpeta del instantclient
    libDir: '/Users/abacusmobile/Documents/Semestre 10/TecRoom/instantclient_23_3',
    //Aqui pon la ruta donde tienes el wallet descomprimido
    configDir: '/Users/abacusmobile/Documents/Semestre 10/TecRoom/Wallet_TecRoom'})

    oracledb.poolMax = 10;
    oracledb.poolMin = 2;
    oracledb.poolIncrement = 2;
    oracledb.poolTimeout = 600;

    async function initialize() {
        try{
            await oracledb.createPool({
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                connectString: process.env.DB_CONNECTION_STRING,
                ssl:{
                    ssl: true,
                    wallet:{
                        //igual aqui cambia la ruta del wallet
                        directory: '/Users/abacusmobile/Documents/Semestre 10/TecRoom/Wallet_TecRoom'
                    }
                }
            })
            console.log('Connection pool created successfully');
            
        }catch(error){
            console.error('Error creating connection pool', error);
            throw error;
        }
    }
async function closePool() {
    try{
        await oracledb.getPool().close();
        console.log('Pool closed');
    }catch(error){
        console.error('Error closing pool:', error);
        throw error;
    }
}

async function executeQuery(query, bindParams = [], options = {}) {
    let connection;
    try{
        connection = await oracledb.getPool().getConnection();
        const result = await connection.execute(query, bindParams, options);
        return result
    }catch(error){
        console.error('Error executing query:',error);
        throw error;
    }finally{
        if(connection){
            try{
                await connection.close();
            }catch(err){
                console.error('Error closing connection:', err);
            }
        }
    }
}

module.exports = {
    initialize,
    closePool,
    executeQuery
}