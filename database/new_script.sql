-- #######################################################################
-- # SCRIPT DE CREACIÓN FINAL DE LA BASE DE DATOS AUDITABLE (ORACLE)
-- #######################################################################

-- -----------------------------------------------------------------------
-- 1. CREACIÓN DE SECUENCIAS
-- -----------------------------------------------------------------------
CREATE SEQUENCE usuarios_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE proyectos_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE tareas_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE avances_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE sesiones_usuario_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE auditoria_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE archivos_seq START WITH 1 INCREMENT BY 1;


-- -----------------------------------------------------------------------
-- 2. CREACIÓN DE TABLAS PRINCIPALES
-- -----------------------------------------------------------------------

-- USUARIOS
CREATE TABLE USUARIOS (
    usuario_id NUMBER DEFAULT usuarios_seq.NEXTVAL PRIMARY KEY,
    username VARCHAR2(50) UNIQUE NOT NULL,
    password_hash VARCHAR2(255) NOT NULL,
    nombre_completo VARCHAR2(100) NOT NULL,
    email VARCHAR2(100) UNIQUE NOT NULL,
    rol VARCHAR2(20) DEFAULT 'MIEMBRO' NOT NULL 
        CHECK (rol IN ('ADMIN', 'LIDER', 'MIEMBRO')),
    fecha_creacion TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
);

-- PROYECTOS
CREATE TABLE PROYECTOS (
    proyecto_id NUMBER DEFAULT proyectos_seq.NEXTVAL PRIMARY KEY,
    nombre VARCHAR2(100) NOT NULL,
    descripcion CLOB,
    usuario_lider_id NUMBER NOT NULL,
    fecha_inicio TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    fecha_fin_estimada DATE,
    estado VARCHAR2(20) DEFAULT 'PLANIFICACION' NOT NULL
        CHECK (estado IN ('PLANIFICACION', 'ACTIVO', 'COMPLETADO', 'PAUSADO', 'CANCELADO')),
    
    FOREIGN KEY (usuario_lider_id) REFERENCES USUARIOS(usuario_id)
);

-- PERMISOS_PROYECTO
CREATE TABLE PERMISOS_PROYECTO (
    permiso_id NUMBER DEFAULT proyectos_seq.NEXTVAL PRIMARY KEY,
    proyecto_id NUMBER NOT NULL,
    usuario_id NUMBER NOT NULL,
    rol_proyecto VARCHAR2(20) DEFAULT 'MIEMBRO' NOT NULL
        CHECK (rol_proyecto IN ('MIEMBRO', 'OBSERVADOR')),
    
    FOREIGN KEY (proyecto_id) REFERENCES PROYECTOS(proyecto_id),
    FOREIGN KEY (usuario_id) REFERENCES USUARIOS(usuario_id),
    UNIQUE (proyecto_id, usuario_id)
);

-- TAREAS
CREATE TABLE TAREAS (
    tarea_id NUMBER DEFAULT tareas_seq.NEXTVAL PRIMARY KEY,
    proyecto_id NUMBER NOT NULL,
    titulo VARCHAR2(150) NOT NULL,
    descripcion CLOB,
    usuario_asignado_id NUMBER,
    prioridad VARCHAR2(20) DEFAULT 'MEDIA' NOT NULL
        CHECK (prioridad IN ('BAJA', 'MEDIA', 'ALTA', 'URGENTE')),
    estado VARCHAR2(20) DEFAULT 'PENDIENTE' NOT NULL
        CHECK (estado IN ('PENDIENTE', 'EN_PROGRESO', 'EN_REVISION', 'COMPLETADA', 'BLOQUEADA')),
    fecha_limite DATE,
    fecha_creacion TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    
    FOREIGN KEY (proyecto_id) REFERENCES PROYECTOS(proyecto_id),
    FOREIGN KEY (usuario_asignado_id) REFERENCES USUARIOS(usuario_id)
);

-- AVANCES
CREATE TABLE AVANCES (
    avance_id NUMBER DEFAULT avances_seq.NEXTVAL PRIMARY KEY,
    tarea_id NUMBER NOT NULL,
    usuario_id NUMBER NOT NULL,
    porcentaje_avance NUMBER(3) DEFAULT 0 NOT NULL
        CHECK (porcentaje_avance BETWEEN 0 AND 100),
    comentario CLOB,
    fecha_avance TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    
    FOREIGN KEY (tarea_id) REFERENCES TAREAS(tarea_id),
    FOREIGN KEY (usuario_id) REFERENCES USUARIOS(usuario_id)
);

-- SESIONES_USUARIO (Sesiones Auditables)
CREATE TABLE SESIONES_USUARIO (
    sesion_id NUMBER DEFAULT sesiones_usuario_seq.NEXTVAL PRIMARY KEY,
    usuario_id NUMBER NOT NULL,
    fecha_inicio TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    fecha_fin TIMESTAMP,
    estado VARCHAR2(10) DEFAULT 'ACTIVA' 
        CHECK (estado IN ('ACTIVA', 'CERRADA')),
    ip_acceso VARCHAR2(50),
    
    FOREIGN KEY (usuario_id) REFERENCES USUARIOS(usuario_id)
);

-- ARCHIVOS
CREATE TABLE ARCHIVOS (
    archivo_id NUMBER DEFAULT archivos_seq.NEXTVAL PRIMARY KEY,
    nombre_archivo VARCHAR2(255) NOT NULL,
    ruta_almacenamiento VARCHAR2(500) NOT NULL,
    tipo_mime VARCHAR2(100),
    usuario_subida_id NUMBER NOT NULL,
    proyecto_id NUMBER,
    tarea_id NUMBER,
    fecha_subida TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,

    FOREIGN KEY (usuario_subida_id) REFERENCES USUARIOS(usuario_id),
    FOREIGN KEY (proyecto_id) REFERENCES PROYECTOS(proyecto_id),
    FOREIGN KEY (tarea_id) REFERENCES TAREAS(tarea_id),
    CHECK (proyecto_id IS NOT NULL OR tarea_id IS NOT NULL) -- Debe asociarse a algo
);

-- AUDITORIA (Tabla Central de Auditoría)
CREATE TABLE AUDITORIA (
    auditoria_id NUMBER DEFAULT auditoria_seq.NEXTVAL PRIMARY KEY,
    tabla_afectada VARCHAR2(50) NOT NULL,
    operacion VARCHAR2(10) NOT NULL, -- INSERT, UPDATE, DELETE
    fecha_registro TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    usuario_ejecucion VARCHAR2(50) DEFAULT USER, -- Usuario de la DB
    usuario_id NUMBER, -- ID del usuario de la aplicación afectado
    datos_anteriores CLOB,
    datos_nuevos CLOB
);


-- -----------------------------------------------------------------------
-- 3. VISTA DE REPORTE
-- -----------------------------------------------------------------------
CREATE OR REPLACE VIEW VISTA_PROYECTOS_DETALLE AS
SELECT 
    p.proyecto_id,
    p.nombre AS proyecto_nombre,
    p.estado AS proyecto_estado,
    u_lider.nombre_completo AS lider,
    
    (SELECT COUNT(t.tarea_id) FROM TAREAS t WHERE t.proyecto_id = p.proyecto_id) AS total_tareas,
    (SELECT COUNT(t.tarea_id) FROM TAREAS t WHERE t.proyecto_id = p.proyecto_id AND t.estado = 'COMPLETADA') AS tareas_completadas,
    
    (SELECT COUNT(pm.usuario_id) FROM PERMISOS_PROYECTO pm WHERE pm.proyecto_id = p.proyecto_id) + 1 AS total_miembros
    
FROM PROYECTOS p
JOIN USUARIOS u_lider ON p.usuario_lider_id = u_lider.usuario_id;


-- -----------------------------------------------------------------------
-- 4. PROCEDIMIENTOS ALMACENADOS
-- -----------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE ASIGNAR_TAREA(
    p_tarea_id IN NUMBER,
    p_usuario_id IN NUMBER
)
IS
BEGIN
    UPDATE TAREAS
    SET usuario_asignado_id = p_usuario_id,
        estado = CASE WHEN estado = 'PENDIENTE' THEN 'EN_PROGRESO' ELSE estado END
    WHERE tarea_id = p_tarea_id;
    
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/

-- -----------------------------------------------------------------------
-- 5. TRIGGERS (AUDITORÍA AUTOMÁTICA)
-- -----------------------------------------------------------------------

-- TRIGGER 1: Auditoría de TAREAS (Registra cambios de estado y asignación)
CREATE OR REPLACE TRIGGER audit_tareas
AFTER INSERT OR UPDATE OR DELETE ON TAREAS
FOR EACH ROW
DECLARE
    v_operacion VARCHAR2(10);
BEGIN
    IF INSERTING THEN
        v_operacion := 'INSERT';
        INSERT INTO AUDITORIA (tabla_afectada, operacion, usuario_id, datos_nuevos)
        VALUES ('TAREAS', v_operacion, :NEW.usuario_asignado_id, 
                'Nueva tarea: ' || :NEW.titulo || ', Proyecto ID: ' || :NEW.proyecto_id);
    ELSIF UPDATING THEN
        v_operacion := 'UPDATE';
        INSERT INTO AUDITORIA (tabla_afectada, operacion, usuario_id,
                                datos_anteriores, datos_nuevos)
        VALUES ('TAREAS', v_operacion, :NEW.usuario_asignado_id,
                'Estado anterior: ' || :OLD.estado,
                'Estado nuevo: ' || :NEW.estado || ', Prioridad: ' || :NEW.prioridad);
    ELSIF DELETING THEN
        v_operacion := 'DELETE';
        INSERT INTO AUDITORIA (tabla_afectada, operacion, usuario_id, datos_anteriores)
        VALUES ('TAREAS', v_operacion, :OLD.usuario_asignado_id,
                'Tarea eliminada: ' || :OLD.titulo);
    END IF;
END;
/

-- TRIGGER 2: Auditoría de SESIONES_USUARIO (Registra acceso)
CREATE OR REPLACE TRIGGER audit_sesiones
AFTER INSERT OR UPDATE ON SESIONES_USUARIO
FOR EACH ROW
BEGIN
    IF INSERTING THEN
        INSERT INTO AUDITORIA (tabla_afectada, operacion, usuario_id, datos_nuevos)
        VALUES ('SESIONES_USUARIO', 'INSERT', :NEW.usuario_id,
                'Inicio de sesión, IP: ' || :NEW.ip_acceso);
    ELSIF UPDATING AND :NEW.estado = 'CERRADA' THEN
        INSERT INTO AUDITORIA (tabla_afectada, operacion, usuario_id, datos_nuevos)
        VALUES ('SESIONES_USUARIO', 'UPDATE', :NEW.usuario_id,
                'Cierre de sesión');
    END IF;
END;
/


-- -----------------------------------------------------------------------
-- 6. DATOS DE PRUEBA
-- -----------------------------------------------------------------------

-- Insertar usuarios iniciales
INSERT INTO USUARIOS (username, password_hash, nombre_completo, email, rol) 
VALUES ('admin', '$2y$10$tWbHn2M9G8Wf3QJ4X3Y0O.zV2.F1.I4eYt.R0P9lZ', 'Administrador Global', 'admin@proyecto.com', 'ADMIN');
INSERT INTO USUARIOS (username, password_hash, nombre_completo, email, rol) 
VALUES ('jlider', '$2y$10$tWbHn2M9G8Wf3QJ4X3Y0O.zV2.F1.I4eYt.R0P9lZ', 'Juan Líder', 'juan.lider@proyecto.com', 'LIDER');
INSERT INTO USUARIOS (username, password_hash, nombre_completo, email, rol) 
VALUES ('mmiembro', '$2y$10$tWbHn2M9G8Wf3QJ4X3Y0O.zV2.F1.I4eYt.R0P9lZ', 'María Miembro', 'maria.miembro@proyecto.com', 'MIEMBRO');
INSERT INTO USUARIOS (username, password_hash, nombre_completo, email, rol) 
VALUES ('dmiembro', '$2y$10$tWbHn2M9G8Wf3QJ4X3Y0O.zV2.F1.I4eYt.R0P9lZ', 'David Miembro', 'david.miembro@proyecto.com', 'MIEMBRO');

-- Insertar un proyecto de prueba
INSERT INTO PROYECTOS (nombre, descripcion, usuario_lider_id, fecha_fin_estimada, estado) 
VALUES ('Migración a Oracle Cloud', 'Migración de la base de datos local a Autonomous Database.', 2, DATE '2026-03-31', 'ACTIVO');

-- Insertar tareas para el proyecto 1
INSERT INTO TAREAS (proyecto_id, titulo, descripcion, usuario_asignado_id, prioridad, estado, fecha_limite)
VALUES (1, 'Revisión de Esquema SQL', 'Verificar que las tablas y tipos de datos sean compatibles con OAD.', 3, 'ALTA', 'EN_PROGRESO', DATE '2026-01-15');

INSERT INTO TAREAS (proyecto_id, titulo, descripcion, usuario_asignado_id, prioridad, estado, fecha_limite)
VALUES (1, 'Configuración de Wallet PHP', 'Descargar e instalar la cartera de conexión en el servidor web.', 4, 'URGENTE', 'PENDIENTE', DATE '2026-01-05');

-- Asignar un miembro adicional al proyecto 1
INSERT INTO PERMISOS_PROYECTO (proyecto_id, usuario_id, rol_proyecto) VALUES (1, 4, 'MIEMBRO');

COMMIT;

-- -----------------------------------------------------------------------
-- 7. CREACIÓN DE USUARIO DE APLICACIÓN Y PERMISOS (¡CRÍTICO!)
-- -----------------------------------------------------------------------

-- 7.1 CREAR USUARIO DE APLICACIÓN (Reemplaza la contraseña segura)
CREATE USER APP_USER IDENTIFIED BY "TU_PASSWORD_SECRETA_COMPLEJA";

-- 7.2 PERMISOS DE CONEXIÓN Y BASE DE DATOS
GRANT CONNECT, RESOURCE TO APP_USER;
GRANT UNLIMITED TABLESPACE TO APP_USER;
GRANT DWROLE TO APP_USER; 

-- 7.3 PERMISOS DE OBJETO (CRUD)
-- Se usa el prefijo 'ADMIN.' o el nombre del esquema si no es ADMIN, 
-- pero al ejecutar como ADMIN, no es estrictamente necesario si no hay ambigüedad.
GRANT SELECT, INSERT, UPDATE, DELETE ON USUARIOS TO APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON PROYECTOS TO APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON TAREAS TO APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON AVANCES TO APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON SESIONES_USUARIO TO APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON ARCHIVOS TO APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON PERMISOS_PROYECTO TO APP_USER;

-- Permisos de Vistas, Procedimientos y Auditoría
GRANT SELECT ON VISTA_PROYECTOS_DETALLE TO APP_USER;
GRANT SELECT ON AUDITORIA TO APP_USER; 
GRANT EXECUTE ON ASIGNAR_TAREA TO APP_USER;

COMMIT;



SELECT USERNAME, PASSWORD_HASH 
FROM USUARIOS 
WHERE USERNAME = 'admin';