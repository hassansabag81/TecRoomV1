document.addEventListener('DOMContentLoaded', function() {
    // Check API status first
    checkAPIStatus();
    
    // Initialize form validation
    initFormValidation();
    
    // Initialize password toggle
    initPasswordToggle();
    
    // Initialize form submissions
    initFormSubmissions();
    
    // Add loading animation
    addLoadingAnimation();
});

// Check API Status
async function checkAPIStatus() {
    try {
        const response = await fetch('/api/test');
        const data = await response.json();
        
        // Show database status
        if (data.dbStatus) {
            showStatusMessage(data.dbStatus, data.dbStatus.includes('Conectada') ? 'success' : 'warning');
        }
    } catch (error) {
        console.error('Error checking API status:', error);
        showStatusMessage('Servidor no disponible', 'danger');
    }
}

// Show status message
function showStatusMessage(message, type) {
    const existingAlert = document.querySelector('.status-alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} status-alert`;
    alertDiv.style.cssText = 'margin: 10px 0; font-size: 0.9rem;';
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'times-circle'}"></i>
        ${message}
    `;
    
    const container = document.querySelector('.container-fluid');
    container.insertBefore(alertDiv, container.firstChild);
    
    // Auto-hide after 5 seconds for non-error messages
    if (type !== 'danger') {
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Form Validation
function initFormValidation() {
    // Real-time validation for login form
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    emailInput.addEventListener('blur', function() {
        validateUsername(this);
    });
    
    passwordInput.addEventListener('blur', function() {
        validatePassword(this);
    });

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        const registerEmail = document.getElementById('registerEmail');
        const registerPassword = document.getElementById('registerPassword');
        const confirmPassword = document.getElementById('confirmPassword');
        const studentId = document.getElementById('studentId');
        
        registerEmail.addEventListener('blur', function() {
            validateEmail(this);
        });
        
        registerPassword.addEventListener('input', function() {
            validatePassword(this);
            if (confirmPassword.value) {
                validatePasswordMatch(registerPassword, confirmPassword);
            }
        });
        
        confirmPassword.addEventListener('input', function() {
            validatePasswordMatch(registerPassword, this);
        });
        
        studentId.addEventListener('blur', function() {
            validateStudentId(this);
        });
    }
}

// Email validation
function validateEmail(input) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(input.value);
    
    if (input.value && !isValid) {
        showInputError(input, 'Por favor ingresa un correo electrónico válido');
        return false;
    } else if (isValid) {
        showInputSuccess(input);
        return true;
    }
    
    return true;
}

// Username (Student ID) validation
function validateUsername(input) {
    const studentIdRegex = /^\d{8}$/;
    const isValid = studentIdRegex.test(input.value);
    
    if (input.value && !isValid) {
        showInputError(input, 'Por favor ingresa un número de control válido de 8 dígitos');
        return false;
    } else if (isValid) {
        showInputSuccess(input);
        return true;
    }
    
    return true;
}

// Password validation
function validatePassword(input) {
    const password = input.value;
    const minLength = 6;
    
    if (password && password.length < minLength) {
        showInputError(input, `La contraseña debe tener al menos ${minLength} caracteres`);
        return false;
    } else if (password && password.length >= minLength) {
        showInputSuccess(input);
        return true;
    }
    
    return true;
}

// Password match validation
function validatePasswordMatch(password, confirmPassword) {
    if (confirmPassword.value && password.value !== confirmPassword.value) {
        showInputError(confirmPassword, 'Las contraseñas no coinciden');
        return false;
    } else if (confirmPassword.value && password.value === confirmPassword.value) {
        showInputSuccess(confirmPassword);
        return true;
    }
    
    return true;
}

//Numero de control del estudiante
function validateStudentId(input) {
    const studentIdRegex = /^\d{8}$/;
    const isValid = studentIdRegex.test(input.value);
    
    if (input.value && !isValid) {
        showInputError(input, 'El numero de control debe tener 8 dígitos');
        return false;
    } else if (isValid) {
        showInputSuccess(input);
        return true;
    }
    
    return true;
}

//errores
function showInputError(input, message) {
    input.classList.remove('is-valid');
    input.classList.add('is-invalid');
    
    let feedback = input.parentNode.querySelector('.invalid-feedback');
    if (!feedback) {
        feedback = document.createElement('div');
        feedback.className = 'invalid-feedback';
        input.parentNode.appendChild(feedback);
    }
    feedback.textContent = message;
}

// Show input success
function showInputSuccess(input) {
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
    
    const feedback = input.parentNode.querySelector('.invalid-feedback');
    if (feedback) {
        feedback.remove();
    }
}

function initPasswordToggle() {
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            const icon = this.querySelector('i');
            icon.classList.toggle('bi-eye');
            icon.classList.toggle('bi-eye-slash');
        });
    }
}

// Form submissions
function initFormSubmissions() {
    // Login form submission
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleLogin();
    });
    
    // Register form submission
    const registerForm = document.getElementById('registerForm');
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleRegister();
    });
    
    // Forgot password form submission
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    forgotPasswordForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleForgotPassword();
    });
}

// Handle login
async function handleLogin() {
    const studentId = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    // Validate form
    if (!validateUsername(document.getElementById('email')) || 
        !validatePassword(document.getElementById('password'))) {
        showAlert('Por favor corrige los errores en el formulario', 'danger');
        return;
    }
    
    // Show loading state
    const submitBtn = document.querySelector('#loginForm button[type="submit"]');
    setButtonLoading(submitBtn, true);
    
    try {
        // Llamada real a la API del backend
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                studentId: studentId, 
                password: password 
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('Login exitoso:', data);
            
            // Guardar token y datos del usuario
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userData', JSON.stringify(data.user));
            
            if (rememberMe) {
                localStorage.setItem('rememberMe', 'true');
            }
            
            showAlert(`¡Bienvenido/a ${data.user.name}! Redirigiendo a página principal...`, 'success');
            
            // Redirigir a la página principal de proyectos después de 1.5 segundos
            setTimeout(() => {
                console.log('Ejecutando redirección a mainMenu.html');
                const redirectUrl = 'pages/mainMenu.html';
                console.log('URL de destino:', redirectUrl);
                window.location.href = redirectUrl;
            }, 1500);
            
        } else {
            showAlert(data.message || 'Error en el inicio de sesión', 'danger');
        }
        
    } catch (error) {
        console.error('Error en login:', error);
        showAlert('Error de conexión. Verifica que el servidor esté ejecutándose.', 'danger');
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

// Handle register
async function handleRegister() {
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('registerEmail').value;
    const studentId = document.getElementById('studentId').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const acceptTerms = document.getElementById('acceptTerms').checked;
    
    // Validate form
    if (!firstName || !lastName || !email || !studentId || !password || !confirmPassword || !acceptTerms) {
        showAlert('Por favor completa todos los campos', 'danger');
        return;
    }
    
    if (password !== confirmPassword) {
        showAlert('Las contraseñas no coinciden', 'danger');
        return;
    }
    
    // Show loading state
    const submitBtn = document.querySelector('#registerForm button[type="submit"]');
    setButtonLoading(submitBtn, true);
    
    try {
        // Llamada real a la API del backend para registro
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                firstName: firstName,
                lastName: lastName,
                email: email,
                studentId: studentId,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.', 'success');
            
            // Close modal and reset form
            const modal = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
            modal.hide();
            document.getElementById('registerForm').reset();
        } else {
            showAlert(data.message || 'Error al crear la cuenta', 'danger');
        }
        
    } catch (error) {
        console.error('Error en registro:', error);
        showAlert('Error de conexión. Verifica que el servidor esté ejecutándose.', 'danger');
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

// Handle forgot password
async function handleForgotPassword() {
    const email = document.getElementById('forgotEmail').value;
    
    if (!validateEmail(document.getElementById('forgotEmail'))) {
        return;
    }
    
    // Show loading state
    const submitBtn = document.querySelector('#forgotPasswordForm button[type="submit"]');
    setButtonLoading(submitBtn, true);
    
    try {
        // Simulate API call
        await simulateApiCall();
        
        // Here you would normally send the email to your backend
        console.log('Forgot password request:', { email });
        
        // Close modal and reset form
        const modal = bootstrap.Modal.getInstance(document.getElementById('forgotPasswordModal'));
        modal.hide();
        document.getElementById('forgotPasswordForm').reset();
        
    } catch (error) {
        showAlert('Error al enviar el enlace. Por favor intenta nuevamente.', 'danger');
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

// Utility functions
function showAlert(message, type) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());
    
    // Create new alert
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Insert at the top of the form
    const loginForm = document.getElementById('loginForm');
    loginForm.insertBefore(alert, loginForm.firstChild);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.setAttribute('data-original-text', button.innerHTML);
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cargando...';
    } else {
        button.disabled = false;
        button.innerHTML = button.getAttribute('data-original-text');
    }
}

function simulateApiCall() {
    return new Promise(resolve => {
        setTimeout(resolve, 1500);
    });
}

// Add loading animation to page
function addLoadingAnimation() {
    // Add fade-in animation to main elements
    const elements = document.querySelectorAll('.card, .bg-primary > div');
    elements.forEach((element, index) => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            element.style.transition = 'all 0.6s ease';
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, index * 200);
    });
}

// Prevent form submission on Enter in certain inputs
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && e.target.type !== 'submit') {
        const form = e.target.closest('form');
        if (form) {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.click();
            }
        }
    }
});

if (window.innerWidth <= 768) {
    document.addEventListener('focusin', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            setTimeout(() => {
                e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    });
}
