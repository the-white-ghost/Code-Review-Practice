class Sidebar {
    constructor() {
        this.isExpanded = false;
        this.difficultyOpen = false;
        this.selectedDifficulty = null;
        this.createSidebar();
        this.setupEventListeners();
    }

    createSidebar() {
        const sidebar = document.createElement('div');
        sidebar.className = 'sidebar';
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <button class="hamburger-menu">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
                <span class="menu-text">Menu</span>
            </div>
            <div class="sidebar-content">
                <div class="menu-item">
                    <i class="fas fa-save"></i>
                    <span class="menu-text">Saved Problems</span>
                </div>
                <div class="menu-item difficulty-item">
                    <i class="fas fa-chart-line"></i>
                    <span class="menu-text">Difficulty</span>
                    <div class="difficulty-dropdown">
                        <div class="difficulty-option" data-difficulty="0">
                            <i class="fas fa-seedling"></i>
                            <span>Beginner</span>
                        </div>
                        <div class="difficulty-option" data-difficulty="1">
                            <i class="fas fa-tree"></i>
                            <span>Intermediate</span>
                        </div>
                        <div class="difficulty-option" data-difficulty="2">
                            <i class="fas fa-mountain"></i>
                            <span>Advanced</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(sidebar);

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .sidebar {
                position: fixed;
                left: 0;
                top: 0;
                height: 100vh;
                width: 60px;
                background-color: rgba(37, 37, 38, 0.9);
                backdrop-filter: blur(5px);
                color: #e0e0e0;
                transition: width 0.3s ease;
                z-index: 1000;
            }

            .sidebar.expanded {
                width: 200px;
            }

            .sidebar-header {
                padding: 15px;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .hamburger-menu {
                background: none;
                border: none;
                cursor: pointer;
                padding: 5px;
                display: flex;
                flex-direction: column;
                gap: 5px;
                transition: none;
            }

            .hamburger-menu:hover {
                background: none;
                box-shadow: none;
            }

            .hamburger-menu span {
                display: block;
                width: 25px;
                height: 3px;
                background-color: #e0e0e0;
                transition: transform 0.3s ease;
            }

            .sidebar-content {
                padding: 20px 0;
            }

            .menu-item {
                display: flex;
                align-items: center;
                padding: 10px 20px;
                cursor: pointer;
                transition: background-color 0.3s ease;
                position: relative;
            }

            .menu-item:hover {
                background-color: rgba(45, 45, 45, 0.5);
            }

            .menu-item i {
                font-size: 20px;
                width: 20px;
                text-align: center;
            }

            .menu-text {
                margin-left: 15px;
                white-space: nowrap;
                overflow: hidden;
                display: none;
            }

            .sidebar.expanded .menu-text {
                display: inline;
            }

            .difficulty-dropdown {
                position: absolute;
                left: 100%;
                top: 0;
                background-color: rgba(30, 30, 30, 0.95);
                min-width: 150px;
                display: none;
                border-radius: 4px;
                overflow: hidden;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            }

            .difficulty-item.active .difficulty-dropdown {
                display: block;
            }

            .difficulty-option {
                display: flex;
                align-items: center;
                padding: 10px 15px;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .difficulty-option:hover {
                background-color: rgba(45, 45, 45, 0.5);
            }

            .difficulty-option.active {
                background-color: rgba(45, 45, 45, 0.7);
                color: #ff00ff;
            }

            .difficulty-option.active i {
                color: #ff00ff;
            }

            .difficulty-option i {
                font-size: 16px;
                width: 20px;
                margin-right: 10px;
                transition: color 0.3s ease;
            }

            .difficulty-option span {
                white-space: nowrap;
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        const sidebar = document.querySelector('.sidebar');
        const hamburgerMenu = document.querySelector('.hamburger-menu');
        const difficultyItem = document.querySelector('.difficulty-item');
        const difficultyOptions = document.querySelectorAll('.difficulty-option');

        hamburgerMenu.addEventListener('click', () => {
            this.isExpanded = !this.isExpanded;
            sidebar.classList.toggle('expanded', this.isExpanded);
        });

        difficultyItem.addEventListener('click', (e) => {
            e.stopPropagation();
            this.difficultyOpen = !this.difficultyOpen;
            difficultyItem.classList.toggle('active', this.difficultyOpen);
        });

        difficultyOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const difficulty = option.dataset.difficulty;
                
                // Toggle the selected difficulty
                if (this.selectedDifficulty === difficulty) {
                    this.selectedDifficulty = null;
                    option.classList.remove('active');
                } else {
                    // Remove active class from all options
                    difficultyOptions.forEach(opt => opt.classList.remove('active'));
                    // Set new selection
                    this.selectedDifficulty = difficulty;
                    option.classList.add('active');
                }

                // Dispatch custom event with the selected difficulty
                const event = new CustomEvent('difficultyChanged', {
                    detail: { difficulty: this.selectedDifficulty }
                });
                document.dispatchEvent(event);
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            if (this.difficultyOpen) {
                this.difficultyOpen = false;
                difficultyItem.classList.remove('active');
            }
        });
    }

    getSelectedDifficulty() {
        return this.selectedDifficulty;
    }
}

// Initialize the sidebar when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Sidebar();
}); 