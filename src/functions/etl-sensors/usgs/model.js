import {Service} from '../../../services';
import request from 'request';

export class EtlSensors {
  constructor(config) {
    this.config = config;
    request.debug = this.config.DEBUG_HTTP_REQUESTS;
  }

  /**
   * This method gets existing sensors via getSensors lambda
   * @function getExistingSensors
   * @external {XMLHttpRequest}
   * @return {Promise}
   */
  getExistingSensors() {
    const self = this;
    const service = new Service(self.config);

    return new Promise((resolve, reject) => {
      service.getSensors('usgs')
      .then((body) => {
        let existingSensorUids = [];
        const features = body.result.features;

        if (!features.length) {
          resolve(existingSensorUids);
        } else {
          // store uid's from sensors in metadata table
          // filtered by sensor type
          for (let feature of features) {
            if (feature.properties.hasOwnProperty('properties')) {
              const properties = feature.properties.properties;
              if (properties.hasOwnProperty('uid')
                && properties.hasOwnProperty('class')
                && String(properties.class) === self.config.SENSOR_CODE
                && properties.hasOwnProperty('agency')
                && properties.agency === 'usgs'
              ) {
                existingSensorUids.push(properties.uid);
              }
            }
          }
          resolve(existingSensorUids);
        }
      })
      .catch((error) => {
        reject(error);
      });
    });
  }

  /**
   * This method extracts available sensors by querying USGS API
   * @function extractUsgsSensors
   * @param {string[]} uids - list of sensor uid's in metadata
   * @external {XMLHttpRequest}
   * @abstract
   * @return {Promise} Promise object
   */
  extractUsgsSensors(uids) {
    const self = this;
    const usgsQuery = self.config.USGS_BASE_URL
    + '&countyCd=' + self.config.USGS_COUNTY_CODE
    + '&parameterCd=' + self.config.SENSOR_CODE
    + '&siteStatus=' + self.config.USGS_SITE_STATUS;

    return new Promise((resolve, reject) => {
      // Get sensors metadata from USGS source
      request.get({
        url: usgsQuery,
        json: true,
      }, (error, response, body) => {
        if (error) {
          resolve({log: error});
        } else {
          if (body.value.timeSeries.length) {
            resolve({
              existingSensorUids: uids,
              usgsSensors: body.value.timeSeries,
            });
          } else {
            resolve({
              log: 'No sensors received from USGS API',
            });
          }
        }
      });
    });
  }

  compareSensors(sensor, existingSensorUids) {
    return new Promise((resolve, reject) => {
      if (sensor.hasOwnProperty('log')) {
        resolve(sensor);
      } else {
        let sensorExists = false;
        const uidExtracted = sensor.sourceInfo.siteCode[0].value;

        if (existingSensorUids.length) {
          for (let uidExisting of existingSensorUids) {
            if (uidExtracted === uidExisting) {
              sensorExists = true;
            }
          }
          if (!sensorExists) {
            resolve(sensor);
          } else {
            resolve({
              log: uidExtracted + ': Sensor already exists',
            });
          }
        } else {
          resolve(sensor);
        }
      }
    });
  }

  /**
   * This method posts extracted sensor metadata via addSensor lambda
   * @function transform
   * @param {object} sensor - Sensor properties returned from USGS query
   * @return {object}
   */
  transform(sensor) {
    const self = this;

    return new Promise(function(resolve, reject) {
      if (sensor) {
        if (sensor.hasOwnProperty('log')) {
          resolve(sensor);
        } else {
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
              agency: 'usgs',
              type: sensorType,
              class: self.config.SENSOR_CODE,
              units: units,
            },
            location: {
              lat: sensor.sourceInfo.geoLocation.geogLocation.latitude,
              lng: sensor.sourceInfo.geoLocation.geogLocation.longitude,
            },
          };
          resolve(sensorMetadata);
        }
      }
    });
  }

  loadSensor(metadata) {
    const self = this;
    const service = new Service(self.config);

    return new Promise((resolve, reject) => {
      if (metadata.hasOwnProperty('log')) {
        resolve(metadata);
      } else {
        // Load sensors
        service.postSensors('', metadata)
        .then((body) => {
          if (body.statusCode !== 200) {
            reject(body);
          } else {
            const sensorID = body.result.features[0].properties.id;
            resolve({success: sensorID + ': Added sensor'});
          }
        })
        .catch((error) => {
          reject(error);
        });
      }
    });
  }
}
