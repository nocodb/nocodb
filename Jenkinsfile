pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                git 'https://github.com/hafiz-syed-burhan/nocodb.git'
            }
        }

        stage('Start or Restart NocoDB') {
            steps {
                script {
                    sh '''
                        CONTAINER_NAME=nocodb-container

                        # Agar container exist karta hai
                        if [ "$(docker ps -a -q -f name=$CONTAINER_NAME)" ]; then
                            echo "Container exists. Restarting..."
                            docker restart $CONTAINER_NAME
                        else
                            echo "Container does not exist. Creating new one..."
                            docker run -d --name $CONTAINER_NAME -p 8090:8080 nocodb/nocodb:latest
                        fi
                    '''
                }
            }
        }
    }

    post {
        always {
            echo '✅ NocoDB Deployment Pipeline Finished.'
        }
    }
}
