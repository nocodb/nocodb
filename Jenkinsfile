pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                git 'https://github.com/hafiz-syed-burhan/nocodb.git'
            }
        }
        
        stage('Deploy NocoDB') {
            steps {
                script {
                    // Check if container is already running
                    def isRunning = sh(script: "docker ps -q -f name=nocodb-container", returnStdout: true).trim()
                    if (isRunning) {
                        echo "NocoDB container already running, skipping deployment."
                    } else {
                        // Run the container if not running
                        sh 'docker run -d --name nocodb-container -p 8080:8080 nocodb/nocodb:latest'
                    }
                }
            }
        }
    }

    post {
        always {
            echo 'Pipeline finished.'
        }
    }
}
