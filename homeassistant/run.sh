#!/usr/bin/with-contenv bashio
# ==============================================================================
# Home Assistant Community Add-on: F1 MQTT Bridge
# Runs the F1 MQTT Bridge
# ==============================================================================

# Wait for services to become available
bashio::log.info "Starting F1 MQTT Bridge..."

# Read configuration from Home Assistant addon options
export SIGNALR_HUB_URL=$(bashio::config 'signalr_hub_url')
export SIGNALR_HUB_NAME=$(bashio::config 'signalr_hub_name')
export MQTT_BROKER_URL=$(bashio::config 'mqtt_broker_url')
export MQTT_TOPIC_PREFIX=$(bashio::config 'mqtt_topic_prefix')
export MQTT_QOS=$(bashio::config 'mqtt_qos')
export MQTT_RETAIN=$(bashio::config 'mqtt_retain')
export LOG_LEVEL=$(bashio::config 'log_level')
export HA_DISCOVERY_PREFIX=$(bashio::config 'ha_discovery_prefix')
export HA_NODE_ID=$(bashio::config 'ha_node_id')

# Optional configurations
if bashio::config.has_value 'signalr_access_token'; then
    export SIGNALR_ACCESS_TOKEN=$(bashio::config 'signalr_access_token')
fi

if bashio::config.has_value 'mqtt_username'; then
    export MQTT_USERNAME=$(bashio::config 'mqtt_username')
fi

if bashio::config.has_value 'mqtt_password'; then
    export MQTT_PASSWORD=$(bashio::config 'mqtt_password')
fi

if bashio::config.has_value 'mqtt_client_id'; then
    export MQTT_CLIENT_ID=$(bashio::config 'mqtt_client_id')
fi

if bashio::config.has_value 'log_file'; then
    export LOG_FILE=$(bashio::config 'log_file')
fi

# Set default port and health endpoint
export PORT=3000
export HEALTH_ENDPOINT="/health"

# Log configuration
bashio::log.info "Configuration loaded:"
bashio::log.info "SignalR Hub: ${SIGNALR_HUB_URL}"
bashio::log.info "MQTT Broker: ${MQTT_BROKER_URL}"
bashio::log.info "Topic Prefix: ${MQTT_TOPIC_PREFIX}"
bashio::log.info "Log Level: ${LOG_LEVEL}"

# Change to the application directory
cd /opt || bashio::exit.nok "Cannot change to application directory"

# Start the application
bashio::log.info "Starting F1 MQTT Bridge application..."
exec node dist/index.js
