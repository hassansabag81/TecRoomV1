const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const db = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('./'));

// Inicializar base de datos
let dbConnected = false;

async function initializeDatabase() {
    try {
        console.log('Inicializando conexión a Oracle...');
        await db.initialize();
        dbConnected = true;
        console.log('¡Conectado al Autonomous Database!');
    } catch (error) {
        console.error('Error conectando a Oracle:', error.message);
        dbConnected = false;
    }
}

// Ruta de prueba
app.get('/api/test', async (req, res) => {
    if (!dbConnected) {
        return res.status(500).json({
            success: false,
            message: 'Base de datos no disponible',
            timestamp: new Date().toISOString()
        });
    }

    try {
        const result = await db.executeQuery(
            "SELECT 'TecRoom Oracle funcionando! Usuario: ' || USER || ' Fecha: ' || TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI:SS') AS mensaje FROM dual"
        );
        
        // Verificar tablas de TecRoom
        const tablesResult = await db.executeQuery(`
            SELECT table_name, num_rows 
            FROM user_tables 
            WHERE table_name IN ('USUARIOS', 'PROYECTOS', 'TAREAS', 'SESIONES')
            ORDER BY table_name
        `);
        
        res.json({
            success: true,
            message: "¡Oracle funcionando perfectamente! 🎉",
            serverInfo: result.rows[0][0],
            tablesFound: tablesResult.rows.length,
            tables: tablesResult.rows.map(row => ({ name: row[0], rows: row[1] })),
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error en /api/test:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Registro de usuario
app.post('/api/register', async (req, res) => {
    const { firstName, lastName, email, studentId, password } = req.body;
    
    try {
        console.log(`Registrando usuario en Oracle Server: ${firstName} ${lastName} (${studentId})`);
        
        if (!dbConnected) {
            return res.status(500).json({
                success: false,
                message: 'Base de datos no disponible'
            });
        }

        // Verificar si el usuario ya existe
        const existingUser = await db.executeQuery(
            `SELECT username FROM usuarios WHERE username = :username OR email = :email`,
            { username: studentId, email: email }
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'El número de control o email ya está registrado'
            });
        }

        // Encriptar contraseña
        const passwordHash = await bcrypt.hash(password, 12);

        // Insertar nuevo usuario
        await db.executeQuery(
            `INSERT INTO usuarios (username, password_hash, email, nombre_completo, rol, activo)
             VALUES (:username, :passwordHash, :email, :nombreCompleto, 'MIEMBRO', 'S')`,
            {
                username: studentId,
                passwordHash: passwordHash,
                email: email,
                nombreCompleto: `${firstName} ${lastName}`
            },
            { autoCommit: true }
        );

        console.log(`Usuario registrado exitosamente: ${studentId}`);

        res.json({
            success: true,
            message: 'Usuario registrado exitosamente',
            username: studentId
        });

    } catch (error) {
        console.error('Error registrando usuario:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// Login de usuario
app.post('/api/login', async (req, res) => {
    const { studentId, password } = req.body;
    
    try {
        console.log(`Login para usuario: ${studentId}`);
        
        if (!dbConnected) {
            return res.status(500).json({
                success: false,
                message: 'Base de datos no disponible'
            });
        }

        // Buscar usuario
        const result = await db.executeQuery(
            `SELECT usuario_id, username, password_hash, nombre_completo, email, rol, activo 
             FROM usuarios 
             WHERE username = :username`,
            { username: studentId }
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const usuario = {
            usuarioId: result.rows[0][0],
            username: result.rows[0][1],
            passwordHash: result.rows[0][2],
            nombreCompleto: result.rows[0][3],
            email: result.rows[0][4],
            rol: result.rows[0][5],
            activo: result.rows[0][6]
        };

        // Verificar cuenta activa
        if (usuario.activo !== 'S') {
            return res.status(401).json({
                success: false,
                message: 'Cuenta desactivada'
            });
        }

        // Verificar contraseña
        const isValidPassword = await bcrypt.compare(password, usuario.passwordHash);
        
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Contraseña incorrecta'
            });
        }

        // Generar JWT
        const token = jwt.sign(
            {
                usuarioId: usuario.usuarioId,
                username: usuario.username,
                userType: usuario.rol.toLowerCase(),
                name: usuario.nombreCompleto
            },
            process.env.JWT_SECRET || 'tu_clave_secreta_aqui',
            { expiresIn: '24h' }
        );

        // Registrar sesión
        await db.executeQuery(
            `INSERT INTO sesiones (usuario_id, token_sesion, direccion_ip, estado)
             VALUES (:usuarioId, :token, :ip, 'ACTIVA')`,
            {
                usuarioId: usuario.usuarioId,
                token: token,
                ip: req.ip || req.connection?.remoteAddress || 'localhost'
            },
            { autoCommit: true }
        );

        console.log(`Login exitoso: ${usuario.nombreCompleto}`);

        res.json({
            success: true,
            message: 'Login exitoso',
            token: token,
            user: {
                usuarioId: usuario.usuarioId,
                username: usuario.username,
                name: usuario.nombreCompleto,
                email: usuario.email,
                rol: usuario.rol,
                userType: usuario.rol.toLowerCase()
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// Middleware para verificar token
function verifyToken(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token de acceso requerido'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu_clave_secreta_aqui');
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Token inválido'
        });
    }
}

// Ruta protegida - perfil de usuario
app.get('/api/profile', verifyToken, async (req, res) => {
    try {
        if (!dbConnected) {
            return res.status(500).json({
                success: false,
                message: 'Base de datos no disponible'
            });
        }

        const result = await db.executeQuery(
            `SELECT usuario_id, username, nombre_completo, email, rol, fecha_registro, activo 
             FROM usuarios 
             WHERE usuario_id = :userId`,
            { userId: req.user.usuarioId }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const usuario = result.rows[0];
        
        res.json({
            success: true,
            user: {
                usuarioId: usuario[0],
                username: usuario[1],
                name: usuario[2],
                email: usuario[3],
                rol: usuario[4],
                fechaRegistro: usuario[5],
                activo: usuario[6]
            }
        });

    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obtener proyectos del usuario
app.get('/api/user/projects', verifyToken, async (req, res) => {
    try {
        if (!dbConnected) {
            return res.status(500).json({
                success: false,
                message: 'Base de datos no disponible'
            });
        }

        console.log(`Obteniendo proyectos para usuario: ${req.user.usuarioId}`);

        // Query simplificada para obtener proyectos del usuario
        const result = await db.executeQuery(`
            SELECT 
                p.proyecto_id,
                p.nombre,
                p.estado,
                p.fecha_inicio,
                p.fecha_fin_estimada,
                u.nombre_completo as lider_nombre
            FROM proyectos p
            LEFT JOIN usuarios u ON p.usuario_lider_id = u.usuario_id
            WHERE p.usuario_lider_id = :userId 
            ORDER BY p.fecha_inicio DESC
        `, { userId: req.user.usuarioId });

        const projects = result.rows.map(row => ({
            proyecto_id: row[0],
            nombre: row[1],
            descripcion: 'Descripción del proyecto',
            estado: row[2],
            fecha_inicio: row[3],
            fecha_fin_estimada: row[4],
            lider_nombre: row[5],
            total_tareas: 10,
            tareas_pendientes: 5,
            tareas_en_progreso: 3,
            tareas_completadas: 2
        }));

        console.log(`Encontrados ${projects.length} proyectos para el usuario`);

        res.json({
            success: true,
            projects: projects,
            count: projects.length
        });

    } catch (error) {
        console.error('Error obteniendo proyectos:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo proyectos',
            error: error.message
        });
    }
});

// Obtener estadísticas del usuario
app.get('/api/user/stats', verifyToken, async (req, res) => {
    try {
        if (!dbConnected) {
            return res.status(500).json({
                success: false,
                message: 'Base de datos no disponible'
            });
        }

        console.log(`Obteniendo estadísticas para usuario: ${req.user.usuarioId}`);

        // Obtener estadísticas de proyectos
        const projectStatsResult = await db.executeQuery(`
            SELECT COUNT(*) as total_proyectos
            FROM proyectos p
            WHERE 
                p.usuario_lider_id = :userId 
                OR p.proyecto_id IN (
                    SELECT DISTINCT t.proyecto_id 
                    FROM tareas t 
                    WHERE t.usuario_asignado_id = :userId
                )
        `, { userId: req.user.usuarioId });

        // Obtener estadísticas de tareas
        const taskStatsResult = await db.executeQuery(`
            SELECT 
                COUNT(*) as total_tareas,
                SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END) as tareas_pendientes,
                SUM(CASE WHEN estado = 'EN_PROGRESO' THEN 1 ELSE 0 END) as tareas_activas,
                SUM(CASE WHEN estado = 'COMPLETADA' THEN 1 ELSE 0 END) as tareas_completadas
            FROM tareas t
            WHERE 
                t.usuario_asignado_id = :userId
                OR t.proyecto_id IN (
                    SELECT proyecto_id 
                    FROM proyectos 
                    WHERE usuario_lider_id = :userId
                )
        `, { userId: req.user.usuarioId });

        const stats = {
            totalProjects: projectStatsResult.rows[0] ? projectStatsResult.rows[0][0] : 0,
            totalTasks: taskStatsResult.rows[0] ? taskStatsResult.rows[0][0] : 0,
            pendingTasks: taskStatsResult.rows[0] ? taskStatsResult.rows[0][1] : 0,
            activeTasks: taskStatsResult.rows[0] ? taskStatsResult.rows[0][2] : 0,
            completedTasks: taskStatsResult.rows[0] ? taskStatsResult.rows[0][3] : 0
        };

        console.log('Estadísticas obtenidas:', stats);

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas',
            error: error.message
        });
    }
});

// Endpoint temporal para debug/admin SQL (solo para desarrollo)
app.post('/api/admin-sql', async (req, res) => {
    const { sql } = req.body;
    
    try {
        if (!dbConnected) {
            return res.status(500).json({
                success: false,
                message: 'Base de datos no disponible'
            });
        }

        console.log('Ejecutando SQL admin:', sql);
        const result = await db.executeQuery(sql, [], { autoCommit: true });
        
        res.json({
            success: true,
            message: 'SQL ejecutado exitosamente',
            result: result
        });
    } catch (error) {
        console.error('Error ejecutando SQL admin:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Manejo de errores
process.on('SIGINT', async () => {
    console.log('\nCerrando servidor...');
    if (dbConnected) {
        try {
            await db.closePool();
            console.log('Pool de conexiones cerrado');
        } catch (error) {
            console.error('Error cerrando pool:', error);
        }
    }
    process.exit(0);
});

// Iniciar servidor
async function startServer() {
    await initializeDatabase();
    
    app.listen(PORT, () => {
        console.log(`\n--TecRoom Server iniciado--`);
        console.log(`Frontend: http://localhost:${PORT}`);
        console.log(`API: http://localhost:${PORT}/api`);
        console.log(`Test: http://localhost:${PORT}/api/test`);
        console.log(`Base de datos: ${dbConnected ? 'Oracle conectada' : 'Desconectada'}`);
    });
}

startServer();
