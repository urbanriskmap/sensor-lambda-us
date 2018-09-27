/**
 * This method compares a sensor against a list of
 * all stored sensors using the unique id value
 * @function compareSensor
 * @param {object} sensor - Sensor interface
 * @param {string} uniqueIdKey - Sensor unique id property
 * @param {string[]} existingSensorUids - list of sensor uid's
 * @return {Promise<object>} Promise object
 */
export default (sensor, uniqueIdKey, existingSensorUids) => {
  return new Promise((resolve, reject) => {
    let sensorExists = false;
    const sensorUid = sensor.properties[uniqueIdKey];

    if (existingSensorUids.length) {
      for (const uidExisting of existingSensorUids) {
        if (sensorUid === uidExisting) {
          sensorExists = true;
          break;
        }
      }

      if (!sensorExists) {
        resolve(sensor);
      } else {
        resolve({
          log: sensorUid,
        });
      }
    } else {
      resolve(sensor);
    }
  });
};
