import request from 'request';

export default (endpoint, id, dataType) => {
  return new Promise((resolve, reject) => {
    let queryUrl = endpoint + id;

    queryUrl += dataType ? '?type=' + dataType : '';

    request.get({
      url: queryUrl,
      json: true,
    }, (error, response, body) => {
      if (error) reject(error);

      let storedObservations;
      let storedObsCheckPassed = false;
      let lastStoredDataId;
      let latestRow;

      if (body.result) {
        if (Array.isArray(body.result) && body.result.length) {
          latestRow = body.result[0];
        }
      } else {
        reject(body);
      }

      if (latestRow
        && latestRow.hasOwnProperty('properties')
        && latestRow.properties
      ) {
        storedObsCheckPassed = true;
        storedObservations = latestRow.properties.observations;
        lastStoredDataId = latestRow.dataId;
      }

      resolve({
        checksPassed: storedObsCheckPassed,
        storedObs: storedObservations,
        lastDataId: lastStoredDataId,
      });
    });
  });
};