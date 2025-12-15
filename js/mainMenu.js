// TecRoom - Main Menu JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication and load user data
    checkAuthentication();
    
    // Initialize event listeners
    initEventListeners();
    
    // Load user projects and data
    loadUserData();
});

// Global variables
let currentUser = null;
let userProjects = [];

// Check if user is authenticated
function checkAuthentication() {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    
    if (!token || !userData) {
        // Redirect to login if not authenticated
        window.location.href = '../index.html';
        return;
    }
    
    try {
        currentUser = JSON.parse(userData);
        updateUserInterface();
    } catch (error) {
        console.error('Error parsing user data:', error);
        logout();
    }
}

// Update user interface with user information
function updateUserInterface() {
    if (!currentUser) return;
    
    // Update user name in navigation and welcome section
    document.getElementById('userName').textContent = currentUser.name || currentUser.username;
    document.getElementById('welcomeUserName').textContent = currentUser.name || currentUser.username;
    
    console.log('✅ Usuario autenticado:', currentUser);
}

// Initialize event listeners
function initEventListeners() {
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        logout();
    });
    
    // Refresh projects button
    document.getElementById('refreshProjectsBtn').addEventListener('click', function() {
        loadUserProjects();
    });
}

// Load all user data
async function loadUserData() {
    try {
        showLoadingState(true);
        
        // Load user projects
        await loadUserProjects();
        
        // Load user statistics
        await loadUserStats();
        
    } catch (error) {
        console.error('Error loading user data:', error);
        showErrorMessage('Error cargando datos del usuario');
    } finally {
        showLoadingState(false);
    }
}

// Load user projects from API
async function loadUserProjects() {
    try {
        const token = localStorage.getItem('authToken');
        
        const response = await fetch('/api/user/projects', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            userProjects = data.projects || [];
            displayProjects();
            updateProjectStats();
        } else {
            throw new Error(data.message || 'Error cargando proyectos');
        }
        
    } catch (error) {
        console.error('Error loading projects:', error);
        
        // Show sample projects if API is not available yet
        showSampleProjects();
    }
}

// Display projects in the interface
function displayProjects() {
    const projectsList = document.getElementById('projectsList');
    const projectsContainer = document.getElementById('projectsContainer');
    const noProjectsMessage = document.getElementById('noProjectsMessage');
    
    if (userProjects.length === 0) {
        projectsContainer.style.display = 'none';
        noProjectsMessage.style.display = 'block';
        return;
    }
    
    projectsContainer.style.display = 'block';
    noProjectsMessage.style.display = 'none';
    
    projectsList.innerHTML = '';
    
    userProjects.forEach((project, index) => {
        const projectCard = createProjectCard(project);
        projectsList.appendChild(projectCard);
        
        // Add animation delay
        setTimeout(() => {
            projectCard.style.opacity = '1';
            projectCard.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

// Create project card HTML element
function createProjectCard(project) {
    const col = document.createElement('div');
    col.className = 'col-lg-6 col-xl-4';
    
    const statusClass = `status-${project.estado.toLowerCase().replace('_', '-')}`;
    const progressPercentage = calculateProjectProgress(project);
    
    col.innerHTML = `
        <div class="project-card" style="opacity: 0; transform: translateY(20px); transition: all 0.5s ease;">
            <div class="project-card-header">
                <h5 class="project-title">${project.nombre}</h5>
                <p class="project-description">${project.descripcion || 'Sin descripción'}</p>
            </div>
            <div class="project-card-body">
                <div class="project-meta">
                    <div class="meta-item">
                        <i class="fas fa-calendar-alt"></i>
                        Inicio: ${formatDate(project.fecha_inicio)}
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-user"></i>
                        Líder: ${project.lider_nombre}
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-flag"></i>
                        <span class="project-status ${statusClass}">${formatStatus(project.estado)}</span>
                    </div>
                </div>
                
                <div class="progress-section">
                    <div class="d-flex justify-content-between mb-1">
                        <span class="small">Progreso del proyecto</span>
                        <span class="small">${progressPercentage}%</span>
                    </div>
                    <div class="progress">
                        <div class="progress-bar bg-success" role="progressbar" 
                             style="width: ${progressPercentage}%"></div>
                    </div>
                </div>
                
                <div class="task-summary">
                    <div class="task-count">
                        <span class="task-count-number text-primary">${project.total_tareas || 0}</span>
                        <span class="task-count-label">Total</span>
                    </div>
                    <div class="task-count">
                        <span class="task-count-number text-warning">${project.tareas_pendientes || 0}</span>
                        <span class="task-count-label">Pendientes</span>
                    </div>
                    <div class="task-count">
                        <span class="task-count-number text-success">${project.tareas_completadas || 0}</span>
                        <span class="task-count-label">Completadas</span>
                    </div>
                </div>
                
                <div class="mt-3">
                    <button class="btn btn-outline-primary btn-sm me-2" onclick="viewProjectDetails(${project.proyecto_id})">
                        <i class="fas fa-info-circle me-1"></i>Ver Detalles
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="viewProjectTasks(${project.proyecto_id})">
                        <i class="fas fa-tasks me-1"></i>Ver Tareas
                    </button>
                </div>
            </div>
        </div>
    `;
    
    return col;
}

// Calculate project progress based on completed tasks
function calculateProjectProgress(project) {
    const total = project.total_tareas || 0;
    const completed = project.tareas_completadas || 0;
    
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'No definida';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Format status for display
function formatStatus(status) {
    const statusMap = {
        'ACTIVO': 'Activo',
        'PAUSADO': 'Pausado',
        'COMPLETADO': 'Completado',
        'PLANIFICACION': 'Planificación',
        'CANCELADO': 'Cancelado'
    };
    
    return statusMap[status] || status;
}

// Load and update user statistics
async function loadUserStats() {
    try {
        const token = localStorage.getItem('authToken');
        
        const response = await fetch('/api/user/stats', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            updateStatsCards(data.stats);
        } else {
            // Use calculated stats from projects if API not available
            updateStatsFromProjects();
        }
        
    } catch (error) {
        console.error('Error loading stats:', error);
        updateStatsFromProjects();
    }
}

// Update stats cards with data
function updateStatsCards(stats) {
    document.getElementById('totalProjects').textContent = stats.totalProjects || userProjects.length;
    document.getElementById('activeTasks').textContent = stats.activeTasks || 0;
    document.getElementById('pendingTasks').textContent = stats.pendingTasks || 0;
    document.getElementById('completedTasks').textContent = stats.completedTasks || 0;
}

// Calculate stats from loaded projects
function updateStatsFromProjects() {
    const totalProjects = userProjects.length;
    let activeTasks = 0;
    let pendingTasks = 0;
    let completedTasks = 0;
    
    userProjects.forEach(project => {
        activeTasks += (project.tareas_en_progreso || 0);
        pendingTasks += (project.tareas_pendientes || 0);
        completedTasks += (project.tareas_completadas || 0);
    });
    
    updateStatsCards({
        totalProjects,
        activeTasks,
        pendingTasks,
        completedTasks
    });
}

// Update project statistics in cards
function updateProjectStats() {
    // Update total projects count
    document.getElementById('totalProjects').textContent = userProjects.length;
}

// Show sample projects for demonstration
function showSampleProjects() {
    console.log('📝 Mostrando proyectos de ejemplo (API no disponible)');
    
    userProjects = [
        {
            proyecto_id: 1,
            nombre: "Sistema de Gestión Académica",
            descripcion: "Desarrollo de un sistema para gestionar estudiantes, materias y calificaciones",
            estado: "ACTIVO",
            fecha_inicio: "2025-01-15",
            fecha_fin_estimada: "2025-06-30",
            lider_nombre: "Prof. García",
            total_tareas: 15,
            tareas_pendientes: 8,
            tareas_en_progreso: 4,
            tareas_completadas: 3
        },
        {
            proyecto_id: 2,
            nombre: "App Móvil de Biblioteca",
            descripcion: "Aplicación móvil para consultar y reservar libros de la biblioteca",
            estado: "PLANIFICACION",
            fecha_inicio: "2025-02-01",
            fecha_fin_estimada: "2025-07-15",
            lider_nombre: "Prof. Martínez",
            total_tareas: 12,
            tareas_pendientes: 10,
            tareas_en_progreso: 2,
            tareas_completadas: 0
        }
    ];
    
    displayProjects();
    updateStatsFromProjects();
}

// View project details
function viewProjectDetails(projectId) {
    const project = userProjects.find(p => p.proyecto_id === projectId);
    if (!project) return;
    
    const modalBody = document.getElementById('projectDetails');
    modalBody.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6><i class="fas fa-info-circle me-2"></i>Información General</h6>
                <table class="table table-sm">
                    <tr><td><strong>Nombre:</strong></td><td>${project.nombre}</td></tr>
                    <tr><td><strong>Estado:</strong></td><td><span class="project-status status-${project.estado.toLowerCase()}">${formatStatus(project.estado)}</span></td></tr>
                    <tr><td><strong>Líder:</strong></td><td>${project.lider_nombre}</td></tr>
                    <tr><td><strong>Fecha Inicio:</strong></td><td>${formatDate(project.fecha_inicio)}</td></tr>
                    <tr><td><strong>Fecha Estimada:</strong></td><td>${formatDate(project.fecha_fin_estimada)}</td></tr>
                </table>
            </div>
            <div class="col-md-6">
                <h6><i class="fas fa-chart-bar me-2"></i>Estadísticas</h6>
                <div class="mb-3">
                    <div class="d-flex justify-content-between">
                        <span>Progreso</span>
                        <span>${calculateProjectProgress(project)}%</span>
                    </div>
                    <div class="progress">
                        <div class="progress-bar bg-success" style="width: ${calculateProjectProgress(project)}%"></div>
                    </div>
                </div>
                <table class="table table-sm">
                    <tr><td><strong>Total Tareas:</strong></td><td>${project.total_tareas || 0}</td></tr>
                    <tr><td><strong>Pendientes:</strong></td><td class="text-warning">${project.tareas_pendientes || 0}</td></tr>
                    <tr><td><strong>En Progreso:</strong></td><td class="text-info">${project.tareas_en_progreso || 0}</td></tr>
                    <tr><td><strong>Completadas:</strong></td><td class="text-success">${project.tareas_completadas || 0}</td></tr>
                </table>
            </div>
        </div>
        <div class="row mt-3">
            <div class="col-12">
                <h6><i class="fas fa-align-left me-2"></i>Descripción</h6>
                <p class="text-muted">${project.descripcion || 'Sin descripción disponible'}</p>
            </div>
        </div>
    `;
    
    // Store current project for tasks view
    document.getElementById('viewProjectTasksBtn').setAttribute('data-project-id', projectId);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('projectModal'));
    modal.show();
}

// View project tasks
function viewProjectTasks(projectId) {
    // TODO: Implement tasks view page
    console.log('📋 Ver tareas del proyecto:', projectId);
    alert('Función de tareas en desarrollo. Próximamente disponible.');
}

// Show/hide loading state
function showLoadingState(isLoading) {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const projectsContainer = document.getElementById('projectsContainer');
    
    if (isLoading) {
        loadingSpinner.style.display = 'block';
        projectsContainer.style.display = 'none';
    } else {
        loadingSpinner.style.display = 'none';
    }
}

// Show error message
function showErrorMessage(message) {
    // Create and show error alert
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show';
    alertDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.container-fluid');
    container.insertBefore(alertDiv, container.firstChild);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Logout function
function logout() {
    // Clear authentication data
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    
    console.log('🚪 Usuario desconectado');
    
    // Redirect to login page
    window.location.href = '../index.html';
}

// Handle view tasks button from modal
document.addEventListener('click', function(e) {
    if (e.target.id === 'viewProjectTasksBtn') {
        const projectId = e.target.getAttribute('data-project-id');
        if (projectId) {
            // Close modal first
            const modal = bootstrap.Modal.getInstance(document.getElementById('projectModal'));
            modal.hide();
            
            // Then view tasks
            viewProjectTasks(parseInt(projectId));
        }
    }
});
