// Script de prueba para debug de redirección
// Ejecutar en la consola del navegador después del login

console.log('Verificando redirección...');

// Simular el proceso de login exitoso
function testRedirection() {
    
    // Simular datos del login
    const mockUser = {
        name: 'Usuario Test',
        username: 'test123'
    };
    
    // Mostrar mensaje
    console.log(`Usuario loggeado: ${mockUser.name}`);
    
    // Intentar redirección
    setTimeout(() => {
        console.log('Ejecutando redirección...');
        const redirectUrl = 'pages/mainMenu.html';
        console.log('URL destino:', redirectUrl);
        console.log('URL actual:', window.location.href);
        
        // Realizar redirección
        window.location.href = redirectUrl;
    }, 1000);
}

// Función para verificar archivos disponibles
function checkFiles() {
    console.log('Verificando si pagina existe...');
    
    fetch('pages/mainMenu.html')
        .then(response => {
            if (response.ok) {
                console.log('pagina existe y es accesible');
            } else {
                console.log('pagina no encontrada o no accesible');
            }
        })
        .catch(error => {
            console.log('Error verificando archivo:', error);
        });
}

// Ejecutar verificaciones
checkFiles();
