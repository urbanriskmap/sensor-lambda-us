import {Service} from '../../../services';
import request from 'request';

export class EtlData {
  constructor(config) {
    this.config = config;
    request.debug = this.config.DEBUG_HTTP_REQUESTS;
  }

  filterSensors() {
    const self = this;
    const service = new Service(self.config);
    let filteredSensorList = [];

    return new Promise((resolve, reject) => {
      service.getSensors()
      .then((body) => {
        const features = body.body.features;

        for (let feature of features) {
          if (feature.properties.hasOwnProperty('properties')) {
            const properties = feature.properties.properties;
            if (properties.hasOwnProperty('uid')
            && properties.hasOwnProperty('class')
            && properties.class === self.config.SENSOR_CODE) {
              filteredSensorList.push({
                pkey: feature.properties.id,
                uid: properties.uid,
              });
            }
          }
        }
        resolve(filteredSensorList);
      })
      .catch((error) => {
        reject(error);
      });
    });
  }

  getStoredObservations(pkey, uid) {
    const self = this;
    const service = new Service(self.config);

    return new Promise((resolve, reject) => {
      service.getSensors(pkey)
      .then((body) => {
        let storedObservations;
        let lastUpdated;
        let dataId;
        let latestRow = body.body[body.body.length - 1];
        if (latestRow.properties
        && latestRow.properties.hasOwnProperty('observations')
        && (latestRow.properties.observations.length
          || latestRow.properties.observations.upstream.length)) {
          storedObservations = latestRow.properties.observations;
          dataId = latestRow.id;
          if (self.config.HAS_UPSTREAM_DOWNSTREAM) {
            lastUpdated = storedObservations.upstream[
              storedObservations.upstream.length - 1].dateTime;
          } else {
            lastUpdated = storedObservations[
              storedObservations.length - 1].dateTime;
          }
          resolve({
            uid: uid,
            pkey: pkey,
            dataId: dataId,
            lastUpdated: lastUpdated,
          });
        } else {
          resolve({
            uid: uid,
            pkey: pkey,
            dataId: null,
            lastUpdated: null,
          });
        }
      })
      .catch((error) => {
        reject(error);
      });
    });
  }

  extractSensorObservations(sensor) {
    const self = this;
    const usgsQuery = self.config.USGS_BASE_URL
    + '&sites=' + sensor.uid
    + '&period=' + self.config.RECORDS_PERIOD;
    // + '&modifiedSince=' + self.config.RECORDS_INTERVAL;
    const logMessage = {
      log: sensor.pkey
      + ': Sensor is inactive or has no new observations in past '
      + self.config.RECORDS_INTERVAL.slice(2, -1) + ' minute(s).',
    };

    return new Promise((resolve, reject) => {
      // Get sensor observations from USGS source
      request.get({
        url: usgsQuery,
        json: true,
      }, (error, response, body) => {
        if (error) {
          reject(error);
        } else {
          if (body.value.timeSeries.length) {
            resolve({
              storedProperties: sensor,
              usgsData: body.value.timeSeries,
            });
          } else {
            resolve(logMessage);
          }
        }
      });
    });
  }

  transform(data) {
    const self = this;
    let observations;
    let transformedData;

    return new Promise((resolve, reject) => {
      if (data.hasOwnProperty('log')) {
        resolve(data);
      } else {
        const sensor = data.storedProperties;
        const sensorData = data.usgsData;
        if (self.config.HAS_UPSTREAM_DOWNSTREAM) {
          observations = {
            upstream: sensorData[0].values[0].value,
            downstream: sensorData[0].values[1].value,
          };
          transformedData = {
            upstream: [],
            downstream: [],
          };
          for (
            let i = 0, j = 0;
            i < observations.upstream.length
            || j < observations.downstream.length;
            i++, j++
          ) {
            if (observations.upstream[i].hasOwnProperty('value')) {
              transformedData.upstream.push({
                dateTime: observations.upstream[i].dateTime,
                value: observations.upstream[i].value,
              });
            }
            if (observations.downstream[j].hasOwnProperty('value')) {
              transformedData.downstream.push({
                dateTime: observations.downstream[j].dateTime,
                value: observations.downstream[j].value,
              });
            }
          }
          resolve({
            pkey: sensor.pkey,
            dataId: sensor.dataId,
            data: transformedData,
            lastUpdated: sensor.lastUpdated,
          });
        } else {
          observations = sensorData[0].values[0].value;
          transformedData = [];
          for (let observation of observations) {
            transformedData.push({
              dateTime: observation.dateTime,
              value: observation.value,
            });
          }
          resolve({
            pkey: sensor.pkey,
            dataId: sensor.dataId,
            data: transformedData,
            lastUpdated: sensor.lastUpdated,
          });
        }
      }
    });
  }

  compareSensorObservations(sensor) {
    const self = this;
    const logMessage = {
      log: sensor.pkey
      + ': Sensor has no new observations',
    };

    return new Promise((resolve, reject) => {
      if (sensor.hasOwnProperty('log')) {
        resolve(sensor);
      } else {
        if (!sensor.lastUpdated) {
          resolve(sensor);
        } else {
          let lastExtractedObservation;
          if (self.config.HAS_UPSTREAM_DOWNSTREAM) {
            lastExtractedObservation = sensor.data.upstream[
                sensor.data.upstream.length - 1].dateTime;
          } else {
            lastExtractedObservation = sensor.data[
              sensor.data.length - 1].dateTime;
          }
          if (lastExtractedObservation === sensor.lastUpdated) {
            resolve(logMessage);
          } else {
            resolve(sensor);
          }
        }
      }
    });
  }

  loadObservations(sensor) {
    const self = this;
    const service = new Service(self.config);

    return new Promise((resolve, reject) => {
      if (sensor.hasOwnProperty('log')) {
        resolve(sensor);
      } else {
        service.postSensors(sensor.pkey, {
          properties: {
            observations: sensor.data,
          },
        })
        .then((body) => {
          if (body.statusCode !== 200) {
            reject(body);
          } else {
            const sensorID = body.body[0].sensor_id;
            if (sensor.dataId) {
              service.deleteObservations(sensor.pkey, sensor.dataId)
              .then(() => {
                resolve({success: sensorID + ': Data for sensor updated'});
              })
              .catch((error) => {
                resolve({log: sensorID
                  + ': Failed to remove previous observations'});
              });
            } else {
              resolve({success: sensorID + ': Data for sensor stored'});
            }
          }
        })
        .catch((error) => {
          reject(error);
        });
      }
    });
  }
}
