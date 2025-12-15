-- 1. TABLA DE USUARIOS
CREATE TABLE usuarios (
    usuario_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR2(50) UNIQUE NOT NULL,
    password_hash VARCHAR2(255) NOT NULL,
    email VARCHAR2(100) UNIQUE NOT NULL,
    nombre_completo VARCHAR2(100) NOT NULL,
    rol VARCHAR2(20) CHECK (rol IN ('ADMIN', 'LIDER', 'MIEMBRO')) NOT NULL,
    fecha_registro DATE DEFAULT SYSDATE,
    activo CHAR(1) DEFAULT 'S' CHECK (activo IN ('S', 'N'))
);

-- 2. TABLA DE PROYECTOS
CREATE TABLE proyectos (
    proyecto_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR2(100) NOT NULL,
    descripcion CLOB,
    usuario_lider_id NUMBER NOT NULL,
    fecha_inicio DATE DEFAULT SYSDATE,
    fecha_fin_estimada DATE,
    estado VARCHAR2(20) DEFAULT 'ACTIVO' 
        CHECK (estado IN ('PLANIFICACION', 'ACTIVO', 'PAUSADO', 'CANCELADO', 'COMPLETADO')),
    FOREIGN KEY (usuario_lider_id) REFERENCES usuarios(usuario_id)
);

-- 3. TABLA DE TAREAS
CREATE TABLE tareas (
    tarea_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    proyecto_id NUMBER NOT NULL,
    titulo VARCHAR2(200) NOT NULL,
    descripcion CLOB,
    usuario_asignado_id NUMBER,
    prioridad VARCHAR2(10) DEFAULT 'MEDIA' 
        CHECK (prioridad IN ('BAJA', 'MEDIA', 'ALTA', 'URGENTE')),
    estado VARCHAR2(20) DEFAULT 'PENDIENTE' 
        CHECK (estado IN ('PENDIENTE', 'EN_PROGRESO', 'EN_REVISION', 'COMPLETADA', 'BLOQUEADA')),
    fecha_creacion DATE DEFAULT SYSDATE,
    fecha_limite DATE,
    fecha_completada DATE,
    porcentaje_avance NUMBER(3) DEFAULT 0 CHECK (porcentaje_avance BETWEEN 0 AND 100),
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(proyecto_id),
    FOREIGN KEY (usuario_asignado_id) REFERENCES usuarios(usuario_id)
);

-- 4. TABLA DE AVANCES/COMENTARIOS
CREATE TABLE avances (
    avance_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tarea_id NUMBER NOT NULL,
    usuario_id NUMBER NOT NULL,
    descripcion CLOB NOT NULL,
    porcentaje_avance NUMBER(3) CHECK (porcentaje_avance BETWEEN 0 AND 100),
    fecha_registro TIMESTAMP DEFAULT SYSTIMESTAMP,
    tipo VARCHAR2(20) DEFAULT 'COMENTARIO' 
        CHECK (tipo IN ('COMENTARIO', 'AVANCE', 'DOCUMENTO', 'PROBLEMA')),
    FOREIGN KEY (tarea_id) REFERENCES tareas(tarea_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id)
);

-- 5. TABLA DE SESIONES (AUDITABLE)
CREATE TABLE sesiones (
    sesion_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id NUMBER NOT NULL,
    token_sesion VARCHAR2(500),
    fecha_inicio TIMESTAMP DEFAULT SYSTIMESTAMP,
    fecha_fin TIMESTAMP,
    direccion_ip VARCHAR2(45),
    navegador VARCHAR2(200),
    sistema_operativo VARCHAR2(100),
    estado VARCHAR2(20) DEFAULT 'ACTIVA' 
        CHECK (estado IN ('ACTIVA', 'CERRADA', 'EXPIRADA')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id)
);

-- 6. TABLA DE AUDITORÍA GENERAL
CREATE TABLE auditoria_general (
    auditoria_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tabla_afectada VARCHAR2(50) NOT NULL,
    operacion VARCHAR2(10) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    usuario_id NUMBER,
    fecha_hora TIMESTAMP DEFAULT SYSTIMESTAMP,
    datos_anteriores CLOB,
    datos_nuevos CLOB,
    direccion_ip VARCHAR2(45),
    descripcion VARCHAR2(500)
);

-- 7. TABLA DE DOCUMENTOS/ARCHIVOS
CREATE TABLE documentos (
    documento_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tarea_id NUMBER,
    proyecto_id NUMBER,
    usuario_id NUMBER NOT NULL,
    nombre_archivo VARCHAR2(255) NOT NULL,
    ruta_almacenamiento VARCHAR2(500) NOT NULL,
    tipo_archivo VARCHAR2(50),
    tamanio_bytes NUMBER,
    fecha_subida TIMESTAMP DEFAULT SYSTIMESTAMP,
    FOREIGN KEY (tarea_id) REFERENCES tareas(tarea_id),
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(proyecto_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id)
);

-- 8. TABLA DE MIEMBROS DE PROYECTO
CREATE TABLE proyecto_miembros (
    proyecto_id NUMBER NOT NULL,
    usuario_id NUMBER NOT NULL,
    fecha_union DATE DEFAULT SYSDATE,
    rol_proyecto VARCHAR2(20) DEFAULT 'MIEMBRO' 
        CHECK (rol_proyecto IN ('LIDER', 'SUPERVISOR', 'MIEMBRO', 'OBSERVADOR')),
    PRIMARY KEY (proyecto_id, usuario_id),
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(proyecto_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id)
);

-- ÍNDICES PARA MEJOR PERFORMANCE
CREATE INDEX idx_tareas_proyecto ON tareas(proyecto_id);
CREATE INDEX idx_tareas_asignado ON tareas(usuario_asignado_id);
CREATE INDEX idx_avances_tarea ON avances(tarea_id);
CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX idx_auditoria_usuario ON auditoria_general(usuario_id);
CREATE INDEX idx_documentos_tarea ON documentos(tarea_id);
CREATE INDEX idx_proyecto_miembros_user ON proyecto_miembros(usuario_id);

-- TRIGGER PARA AUDITORÍA AUTOMÁTICA EN TAREAS
CREATE OR REPLACE TRIGGER audit_tareas
AFTER INSERT OR UPDATE OR DELETE ON tareas
FOR EACH ROW
DECLARE
    v_operacion VARCHAR2(10);
BEGIN
    IF INSERTING THEN
        v_operacion := 'INSERT';
        INSERT INTO auditoria_general (tabla_afectada, operacion, usuario_id, datos_nuevos)
        VALUES ('TAREAS', v_operacion, :NEW.usuario_asignado_id, 
                'Nueva tarea: ' || :NEW.titulo || ', Estado: ' || :NEW.estado);
    ELSIF UPDATING THEN
        v_operacion := 'UPDATE';
        INSERT INTO auditoria_general (tabla_afectada, operacion, usuario_id, 
                                      datos_anteriores, datos_nuevos)
        VALUES ('TAREAS', v_operacion, :NEW.usuario_asignado_id,
                'Estado anterior: ' || :OLD.estado || ', Avance: ' || :OLD.porcentaje_avance,
                'Estado nuevo: ' || :NEW.estado || ', Avance: ' || :NEW.porcentaje_avance);
    ELSIF DELETING THEN
        v_operacion := 'DELETE';
        INSERT INTO auditoria_general (tabla_afectada, operacion, usuario_id, datos_anteriores)
        VALUES ('TAREAS', v_operacion, :OLD.usuario_asignado_id,
                'Tarea eliminada: ' || :OLD.titulo);
    END IF;
END;

-- TRIGGER PARA AUDITORÍA DE SESIONES
CREATE OR REPLACE TRIGGER audit_sesiones
AFTER INSERT OR UPDATE ON sesiones
FOR EACH ROW
BEGIN
    IF INSERTING THEN
        INSERT INTO auditoria_general (tabla_afectada, operacion, usuario_id, datos_nuevos)
        VALUES ('SESIONES', 'INSERT', :NEW.usuario_id,
                'Inicio sesión: ' || TO_CHAR(:NEW.fecha_inicio, 'DD/MM/YYYY HH24:MI'));
    ELSIF UPDATING AND :NEW.estado = 'CERRADA' THEN
        INSERT INTO auditoria_general (tabla_afectada, operacion, usuario_id, datos_nuevos)
        VALUES ('SESIONES', 'UPDATE', :NEW.usuario_id,
                'Cierre sesión: ' || TO_CHAR(:NEW.fecha_fin, 'DD/MM/YYYY HH24:MI'));
    END IF;
END;


-- PROCEDIMIENTO PARA ASIGNAR TAREA
CREATE OR REPLACE PROCEDURE asignar_tarea(
    p_tarea_id IN NUMBER,
    p_usuario_id IN NUMBER
)
IS
BEGIN
    UPDATE tareas 
    SET usuario_asignado_id = p_usuario_id,
        estado = 'EN_PROGRESO'
    WHERE tarea_id = p_tarea_id;
    
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;


-- VISTA PARA REPORTE DE PROYECTOS
CREATE OR REPLACE VIEW vista_proyectos_detalle AS
SELECT 
    p.proyecto_id,
    p.nombre AS proyecto_nombre,
    p.estado AS proyecto_estado,
    u.nombre_completo AS lider,
    COUNT(DISTINCT t.tarea_id) AS total_tareas,
    COUNT(DISTINCT CASE WHEN t.estado = 'COMPLETADA' THEN t.tarea_id END) AS tareas_completadas,
    COUNT(DISTINCT pm.usuario_id) AS total_miembros
FROM proyectos p
JOIN usuarios u ON p.usuario_lider_id = u.usuario_id
LEFT JOIN tareas t ON p.proyecto_id = t.proyecto_id
LEFT JOIN proyecto_miembros pm ON p.proyecto_id = pm.proyecto_id
GROUP BY p.proyecto_id, p.nombre, p.estado, u.nombre_completo;

-- INSERCIÓN DE DATOS DE EJEMPLO
INSERT INTO usuarios (username, password_hash, email, nombre_completo, rol) 
VALUES ('admin', 'hashed_password_123', 'admin@empresa.com', 'Administrador Sistema', 'ADMIN');

INSERT INTO usuarios (username, password_hash, email, nombre_completo, rol) 
VALUES ('jlider', 'hashed_password_456', 'jlider@empresa.com', 'Juan Pérez', 'LIDER');

COMMIT;

-- MOSTRAR ESTRUCTURA CREADA
SELECT table_name, num_rows 
FROM user_tables 
WHERE table_name IN ('USUARIOS', 'PROYECTOS', 'TAREAS', 'AVANCES', 'SESIONES', 'AUDITORIA_GENERAL');



-- Insertar usuarios
INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol) VALUES
('admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'Administrador Principal', 'admin@sistema.com', 'ADMIN');

INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol) VALUES
('jlider', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'Juan Pérez', 'juan@empresa.com', 'LIDER');

INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol) VALUES
('maria', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'María García', 'maria@empresa.com', 'MIEMBRO');

-- Insertar proyectos
INSERT INTO proyectos (nombre, descripcion, usuario_lider_id, estado) VALUES
('Sistema de Gestión de Proyectos', 'Desarrollo del sistema para gestión de proyectos', 2, 'ACTIVO');

INSERT INTO proyectos (nombre, descripcion, usuario_lider_id, estado) VALUES
('Migración Base de Datos', 'Migración de Oracle 11g a 19c', 2, 'PLANIFICACION');


-- Insertar tareas
INSERT INTO tareas (proyecto_id, titulo, usuario_asignado_id, prioridad, estado, porcentaje_avance) VALUES
(1, 'Diseño de base de datos', 3, 'ALTA', 'COMPLETADA', 100);

INSERT INTO tareas (proyecto_id, titulo, usuario_asignado_id, prioridad, estado, porcentaje_avance) VALUES
(1, 'Implementación de triggers', 3, 'ALTA', 'EN_PROGRESO', 75);

INSERT INTO tareas (proyecto_id, titulo, usuario_asignado_id, prioridad, estado, porcentaje_avance) VALUES
(1, 'Pruebas de auditoría', 2, 'MEDIA', 'PENDIENTE', 0);

SELECT * FROM TAREAS;

-- Insertar sesiones de prueba
INSERT INTO sesiones_audit (usuario_id, direccion_ip) VALUES (1, '192.168.1.100');
INSERT INTO sesiones_audit (usuario_id, direccion_ip) VALUES (2, '192.168.1.101');

COMMIT;

-- 1. Eliminar triggers primero (dependen de tablas)
DROP TRIGGER audit_tareas;
DROP TRIGGER audit_sesiones;

-- 2. Eliminar procedimientos y vistas
DROP PROCEDURE asignar_tarea;
DROP VIEW vista_proyectos_detalle;

-- 3. Eliminar índices (se eliminarán automáticamente al borrar tablas, 
-- pero si los quieres borrar explícitamente)
-- (Opcional, normalmente no es necesario)

-- 4. Eliminar tablas en orden inverso (de más dependientes a menos dependientes)
DROP TABLE auditoria_general CASCADE CONSTRAINTS;
DROP TABLE sesiones CASCADE CONSTRAINTS;
DROP TABLE avances CASCADE CONSTRAINTS;
DROP TABLE documentos CASCADE CONSTRAINTS;
DROP TABLE proyecto_miembros CASCADE CONSTRAINTS;
DROP TABLE tareas CASCADE CONSTRAINTS;
DROP TABLE proyectos CASCADE CONSTRAINTS;
DROP TABLE usuarios CASCADE CONSTRAINTS;


DROP TRIGGER audit_tareas;
DROP TRIGGER audit_sesiones;

-- 2. Eliminar procedimientos y vistas
DROP PROCEDURE asignar_tarea;
DROP VIEW vista_proyectos_detalle;

DROP TABLE auditoria_general CASCADE CONSTRAINTS;
DROP TABLE sesiones CASCADE CONSTRAINTS;
DROP TABLE avances CASCADE CONSTRAINTS;
DROP TABLE documentos CASCADE CONSTRAINTS;
DROP TABLE proyecto_miembros CASCADE CONSTRAINTS;
DROP TABLE tareas CASCADE CONSTRAINTS;
DROP TABLE proyectos CASCADE CONSTRAINTS;



DROP TABLE usuarios CASCADE CONSTRAINTS;




BEGIN
    -- Eliminar triggers
    BEGIN
        EXECUTE IMMEDIATE 'DROP TRIGGER audit_tareas';
    EXCEPTION
        WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
        EXECUTE IMMEDIATE 'DROP TRIGGER audit_sesiones';
    EXCEPTION
        WHEN OTHERS THEN NULL;
    END;
    
    -- Eliminar procedimientos
    BEGIN
        EXECUTE IMMEDIATE 'DROP PROCEDURE asignar_tarea';
    EXCEPTION
        WHEN OTHERS THEN NULL;
    END;
    
    -- Eliminar vistas
    BEGIN
        EXECUTE IMMEDIATE 'DROP VIEW vista_proyectos_detalle';
    EXCEPTION
        WHEN OTHERS THEN NULL;
    END;
    
    -- Eliminar tablas en orden inverso
    FOR rec IN (
        SELECT table_name 
        FROM user_tables 
        WHERE table_name IN (
            'AUDITORIA_GENERAL', 'SESIONES', 'AVANCES', 'DOCUMENTOS',
            'PROYECTO_MIEMBROS', 'TAREAS', 'PROYECTOS', 'USUARIOS'
        )
        ORDER BY CASE table_name
            WHEN 'AUDITORIA_GENERAL' THEN 1
            WHEN 'SESIONES' THEN 2
            WHEN 'AVANCES' THEN 3
            WHEN 'DOCUMENTOS' THEN 4
            WHEN 'PROYECTO_MIEMBROS' THEN 5
            WHEN 'TAREAS' THEN 6
            WHEN 'PROYECTOS' THEN 7
            WHEN 'USUARIOS' THEN 8
            ELSE 9
        END
    ) LOOP
        BEGIN
            EXECUTE IMMEDIATE 'DROP TABLE ' || rec.table_name || ' CASCADE CONSTRAINTS';
            DBMS_OUTPUT.PUT_LINE('Tabla ' || rec.table_name || ' eliminada.');
        EXCEPTION
            WHEN OTHERS THEN
                DBMS_OUTPUT.PUT_LINE('Error eliminando ' || rec.table_name || ': ' || SQLERRM);
        END;
    END LOOP;
END;
