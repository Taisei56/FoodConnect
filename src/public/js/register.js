// Registration form handling
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Form submission started');

    let currentStep = 1;
    const totalSteps = 3;
    const form = document.getElementById('registrationForm');

    // Disable browser validation to prevent conflicts
    if (form) {
        form.setAttribute('novalidate', 'true');
    }

    // User type selection
    document.querySelectorAll('.user-type-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.user-type-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            document.getElementById('userType').value = this.dataset.type;
            document.getElementById('nextBtn').disabled = false;
            console.log('✅ User type selected:', this.dataset.type);
        });
    });

    // Step navigation
    document.getElementById('nextBtn').addEventListener('click', function() {
        console.log('🔄 Next button clicked, current step:', currentStep);
        if (validateCurrentStep()) {
            if (currentStep < totalSteps) {
                currentStep++;
                showStep(currentStep);
                console.log('✅ Moved to step:', currentStep);
            }
        }
    });

    document.getElementById('prevBtn').addEventListener('click', function() {
        if (currentStep > 1) {
            currentStep--;
            showStep(currentStep);
            console.log('⬅️ Moved back to step:', currentStep);
        }
    });

    function showStep(step) {
        // Hide all step contents
        document.querySelectorAll('.step-content').forEach(content => {
            content.classList.add('d-none');
        });

        // Show current step content
        document.getElementById(`stepContent${step}`).classList.remove('d-none');

        // Update step indicators
        document.querySelectorAll('.step').forEach((stepEl, index) => {
            stepEl.classList.remove('active', 'completed');
            if (index + 1 < step) {
                stepEl.classList.add('completed');
            } else if (index + 1 === step) {
                stepEl.classList.add('active');
            }
        });

        // Show/hide navigation buttons
        document.getElementById('prevBtn').style.display = step > 1 ? 'block' : 'none';
        document.getElementById('nextBtn').style.display = step < totalSteps ? 'block' : 'none';
        document.getElementById('submitBtn').style.display = step === totalSteps ? 'block' : 'none';

        // Show appropriate profile form and manage required fields
        if (step === 3) {
            const userType = document.getElementById('userType').value;
            document.getElementById('restaurantProfile').classList.add('d-none');
            document.getElementById('influencerProfile').classList.add('d-none');

            // Remove required from hidden fields
            document.querySelectorAll('#restaurantProfile [required], #influencerProfile [required]').forEach(field => {
                field.removeAttribute('required');
            });

            if (userType === 'restaurant') {
                document.getElementById('restaurantProfile').classList.remove('d-none');
                // Add required back to visible restaurant fields
                document.querySelectorAll('#restaurantProfile [name="business_name"], #restaurantProfile [name="address"], #restaurantProfile [name="google_maps_link"], #restaurantProfile [name="state"], #restaurantProfile [name="city"]').forEach(field => {
                    field.setAttribute('required', 'true');
                });
            } else if (userType === 'influencer') {
                document.getElementById('influencerProfile').classList.remove('d-none');
                // Add required back to visible influencer fields
                document.querySelectorAll('#influencerProfile [name="display_name"], #influencerProfile [name="location"], #influencerProfile [name="city"], #influencerProfile [name="state"]').forEach(field => {
                    field.setAttribute('required', 'true');
                });
            }
        }
    }

    function validateCurrentStep() {
        console.log('✅ Form validation passed');

        if (currentStep === 1) {
            return document.getElementById('userType').value !== '';
        } else if (currentStep === 2) {
            const requiredFields = ['first_name', 'last_name', 'email', 'phone', 'password', 'confirm_password'];
            for (let field of requiredFields) {
                const element = document.querySelector(`[name="${field}"]`);
                if (!element || !element.value.trim()) {
                    alert(`Please fill in ${field.replace('_', ' ')}`);
                    return false;
                }
            }

            // Check password match
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            if (password !== confirmPassword) {
                alert('Passwords do not match');
                return false;
            }

            return true;
        } else if (currentStep === 3) {
            const userType = document.getElementById('userType').value;
            if (userType === 'restaurant') {
                const businessName = document.querySelector('[name="business_name"]');
                const address = document.querySelector('[name="address"]');
                const googleMapsLink = document.querySelector('[name="google_maps_link"]');
                const state = document.querySelector('[name="state"]');
                const city = document.querySelector('[name="city"]');

                if (!businessName || !businessName.value.trim()) {
                    alert('Please fill in the business name');
                    return false;
                }
                if (!address || !address.value.trim()) {
                    alert('Please fill in the business address');
                    return false;
                }
                if (!googleMapsLink || !googleMapsLink.value.trim()) {
                    alert('Please provide a Google Maps link for your restaurant');
                    return false;
                }
                if (!state || !state.value) {
                    alert('Please select a state');
                    return false;
                }
                if (!city || !city.value.trim()) {
                    alert('Please fill in the city');
                    return false;
                }
            } else if (userType === 'influencer') {
                const displayName = document.querySelector('[name="display_name"]');
                const location = document.querySelector('[name="location"]');
                const city = document.querySelector('[name="city"]');
                const state = document.querySelector('[name="state"]');

                if (!displayName || !displayName.value.trim()) {
                    alert('Please fill in your display name');
                    return false;
                }
                if (!location || !location.value.trim()) {
                    alert('Please fill in your location');
                    return false;
                }
                if (!city || !city.value.trim()) {
                    alert('Please fill in the city');
                    return false;
                }
                if (!state || !state.value) {
                    alert('Please select a state');
                    return false;
                }
            }
        }
        return true;
    }

    // Form submission with proper data extraction
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            console.log('📦 Extracting form data...');

            if (!validateCurrentStep()) {
                return;
            }

            // Extract basic form data
            const formData = new FormData(form);
            const data = {};

            // Get all form values
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }

            console.log('📋 Basic form data:', data);

            // Handle multiple select fields
            const multiSelects = form.querySelectorAll('select[multiple]');
            multiSelects.forEach(select => {
                const values = Array.from(select.selectedOptions).map(option => option.value);
                data[select.name] = values;
            });

            console.log('🔄 Sending registration data:', data);

            try {
                const response = await fetch('/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });

                console.log('📡 Response status:', response.status);
                console.log('📡 Response headers:', response.headers);

                const result = await response.json();
                console.log('📦 Response data:', result);

                if (response.ok && result.success) {
                    alert('Registration successful! Please check your email to verify your account.');
                    window.location.href = '/auth/login';
                } else {
                    console.error('❌ Registration failed with status:', response.status);
                    console.error('❌ Full error details:', result);
                    alert(result.error || 'Registration failed. Please try again.');
                }
            } catch (error) {
                console.error('❌ Network error:', error);
                alert('Network error. Please check your connection and try again.');
            }
        });
    }

    // Initialize first step
    showStep(1);
});