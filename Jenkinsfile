pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                git branch: 'hafiz-syed-burhan-patch-1',
                    url: 'https://github.com/hafiz-syed-burhan/nocodb.git'
            }
        }

        stage('Deploy NocoDB') {
            steps {
                script {
                    def isRunning = sh(script: "docker ps -q -f name=nocodb-container", returnStdout: true).trim()
                    if (isRunning) {
                        echo "NocoDB container already running, skipping deployment."
                    } else {
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
