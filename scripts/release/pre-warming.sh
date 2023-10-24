#!/bin/bash
# checks the current count of instances
# updates it to double
# runs the check on instances with wait time of 10 seconds

ASG_NAME=nocohub-nocodb_ai_main

# Get the current desired count
current_count=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names ${ASG_NAME} --query 'AutoScalingGroups[0].DesiredCapacity' --output text)

# Double the current count
new_count=$((current_count * 2))

echo updating to new desired ${new_count}

# Update the desired count to be double
aws autoscaling set-desired-capacity --auto-scaling-group-name ${ASG_NAME} --desired-capacity $new_count

# Wait for the new instances to launch with doubled count
timeout=10
while [[ $timeout -gt 0 ]]; do
    current_count=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names ${ASG_NAME} --query 'AutoScalingGroups[0].DesiredCapacity' --output text)
    
    if [[ $current_count -eq $new_count ]]; then
        break
    fi
    
    sleep 1
    ((timeout--))
done

echo "updating desried completed successfully"

