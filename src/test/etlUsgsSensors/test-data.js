export default {
  getSensors() {
    return {
      result: {
        features: [
          {
            properties: {
              id: 4,
              properties: {
                uid: 'uniqueId1',
                class: 'sensorCode',
                agency: 'usgs',
              },
            },
          },
          {
            properties: {
              id: 5,
              properties: {
                uid: 'uniqueId2',
                class: 'sensorCode',
                agency: 'usgs',
              },
            },
          },
          {
            properties: {
              id: 6,
              properties: {
                uid: 'uniqueId3',
                class: 'otherSensorCode',
                agency: 'usgs',
              },
            },
          },
          {
            properties: {
              id: 7,
              otherProperty: 'foo',
            },
          },
          {
            properties: {
              id: 8,
              properties: {
                noUid: 'foo',
                agency: 'usgs',
              },
            },
          },
          {
            properties: {
              id: 9,
              properties: {
                uid: 'foo',
                class: 'foo',
                agency: 'usgs',
              },
            },
          },
        ],
      },
    };
  },

  sensorToCompare(sensorExists) {
    if (sensorExists) {
      return {
        sourceInfo: {
          siteCode: [
            {
              value: 'uniqueId1',
            },
          ],
        },
      };
    } else {
      return {
        sourceInfo: {
          siteCode: [
            {
              value: 'someUniqueId',
            },
          ],
        },
      };
    }
  },

  dataToTransform() {
    return {
      sourceInfo: {
        siteCode: [
          {
            value: 'someUniqueId',
          },
        ],
        siteProperty: [
          {
            name: 'siteTypeCd',
            value: 'sensorType',
          },
        ],
        geoLocation: {
          geogLocation: {
            latitude: 1,
            longitude: 2,
          },
        },
      },
      variable: {
        unit: {
          unitCode: 'ft',
        },
      },
    };
  },
};
