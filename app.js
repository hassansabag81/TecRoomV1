//OJO ESTO ES DE PRUEBA NOMAS PARA SABER SI FUNCIONA EL DATABASE.JS
const db = require('./database.js');

async function main() {
    try{
        await db.initialize();
        const result = await db.executeQuery(
            'select * from usuarios',
            []
        );

        console.log('Query results: ',result.rows);
    }catch(error){
        console.error('Error in main', error);
    }
}

main();