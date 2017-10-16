import config from '../../../config';
import getSensors from '../../../services/getSensors';
import postSensors from '../../../services/postSensors';

const request = require('request');
request.debug = config.DEBUG_HTTP_REQUESTS;

/**
 * Extract available sensors by querying usgs api
 * @function extractUsgsSensors
 * @external {XMLHttpRequest}
 * @return {Promise}
 */
export default {
  /**
   * This method gets existing sensors via getSensors lambda
   * @function getExistingSensors
   * @external {XMLHttpRequest}
   * @return {Promise}
   */
  getExistingSensors() {
    let self = this;
    return new Promise((resolve, reject) => {
      getSensors()
      .then((body) => {
        self.existingSensorUids = [];
        const features = body.body.features;

        // store uid's from sensors in metadata table
        // filtered by sensor type
        for (let feature of features) {
          const properties = feature.properties.properties;
          if (properties.hasOwnProperty('uid')
          && properties.hasOwnProperty('class')
          && properties.class === config.SENSOR_CODE) {
            self.existingSensorUids.push(properties.uid);
          }
        }
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
    });
  },

  /**
   * This method extracts available sensors by querying USGS API
   * @function extractUsgsSensors
   * @external {XMLHttpRequest}
   * @return {Promise}
   */
  extractUsgsSensors() {
    let self = this;
    self.sensorsToLoad = [];
    const usgsQuery = config.USGS_BASE_URL
    + '&countyCd=' + config.USGS_COUNTY_CODE
    + '&parameterCd=' + config.SENSOR_CODE
    + '&siteStatus=' + config.USGS_SITE_STATUS;

    return new Promise((resolve, reject) => {
      // Get sensors metadata from USGS source
      request({
        url: usgsQuery,
        method: 'GET',
        json: true,
      }, (error, response, body) => {
        if (error) {
          reject(error);
        } else {
          const sensors = body.value.timeSeries;

          for (let sensor of sensors) {
            let sensorExists = false;
            const uidExtracted = sensor.sourceInfo.siteCode[0].value;
            for (let uidExisting of self.existingSensorUids) {
              if (uidExtracted === uidExisting) {
                sensorExists = true;
              }
            }
            if (!sensorExists) {
              self.sensorsToLoad.push(sensor);
            }
          }

          resolve();
        }
      });
    });
  },

  /**
   * This method posts extracted sensor metadata via addSensor lambda
   * @function transformAndLoad
   * @external {XMLHttpRequest}
   */
  transformAndLoad() {
    for (let sensor of this.sensorsToLoad) {
      const uid = sensor.sourceInfo.siteCode[0].value;
      const units = sensor.variable.unit.unitCode;
      let sensorType;
      for (let property of sensor.sourceInfo.siteProperty) {
        if (property.name === 'siteTypeCd') {
          sensorType = property.value;
        }
      }

      // Construct body for request
      let sensorMetadata = {
        properties: {
          uid: uid,
          type: sensorType,
          class: config.SENSOR_CODE,
          units: units,
        },
        location: {
          lat: sensor.sourceInfo.geoLocation.geogLocation.latitude,
          lng: sensor.sourceInfo.geoLocation.geogLocation.longitude,
        },
      };

      // Load sensors
      postSensors('', sensorMetadata, this.logResponse);
    }
  },

  /**
   * Extract available sensors by querying usgs api
   * @function logResponse
   * @param {object} error - error object for failed request
   * @param {object} response - response object
   * @param {object} body - response body, sensor metadata as geojson
   * @throws {error} throw error if request or database insert fails
   */
  logResponse(error, response, body) {
    if (error) {
      console.log('Error adding sensor');
      console.error(error);
    } else if (body.statusCode !== 200) {
      console.log('Error adding sensor');
      console.error(body);
    } else {
      const sensorID = body.body.features[0].properties.id;
      console.log('Sensor added with id = ' + sensorID);
    }
  },
};
