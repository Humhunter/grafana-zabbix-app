'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.zabbixTemplateFormat = exports.ZabbixAPIDatasource = undefined;

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); //import angular from 'angular';


var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _datemath = require('app/core/utils/datemath');

var dateMath = _interopRequireWildcard(_datemath);

var _utils = require('./utils');

var utils = _interopRequireWildcard(_utils);

var _migrations = require('./migrations');

var migrations = _interopRequireWildcard(_migrations);

var _metricFunctions = require('./metricFunctions');

var metricFunctions = _interopRequireWildcard(_metricFunctions);

var _dataProcessor = require('./dataProcessor');

var _dataProcessor2 = _interopRequireDefault(_dataProcessor);

var _responseHandler = require('./responseHandler');

var _responseHandler2 = _interopRequireDefault(_responseHandler);

require('./zabbix.js');

var _zabbixAPICoreService = require('./zabbixAPICore.service.js');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ZabbixAPIDatasource = function () {

  /** @ngInject */

  function ZabbixAPIDatasource(instanceSettings, templateSrv, alertSrv, Zabbix) {
    _classCallCheck(this, ZabbixAPIDatasource);

    this.templateSrv = templateSrv;
    this.alertSrv = alertSrv;

    // General data source settings
    this.name = instanceSettings.name;
    this.url = instanceSettings.url;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;

    // Zabbix API credentials
    this.username = instanceSettings.jsonData.username;
    this.password = instanceSettings.jsonData.password;

    // Use trends instead history since specified time
    this.trends = instanceSettings.jsonData.trends;
    this.trendsFrom = instanceSettings.jsonData.trendsFrom || '7d';

    // Set cache update interval
    var ttl = instanceSettings.jsonData.cacheTTL || '1h';
    this.cacheTTL = utils.parseInterval(ttl);

    this.zabbix = new Zabbix(this.url, this.username, this.password, this.basicAuth, this.withCredentials, this.cacheTTL);

    // Use custom format for template variables
    this.replaceTemplateVars = _lodash2.default.partial(replaceTemplateVars, this.templateSrv);
  }

  ////////////////////////
  // Datasource methods //
  ////////////////////////

  /**
   * Query panel data. Calls for each panel in dashboard.
   * @param  {Object} options   Contains time range, targets and other info.
   * @return {Object} Grafana metrics object with timeseries data for each target.
   */


  _createClass(ZabbixAPIDatasource, [{
    key: 'query',
    value: function query(options) {
      var _this = this;

      var timeFrom = Math.ceil(dateMath.parse(options.range.from) / 1000);
      var timeTo = Math.ceil(dateMath.parse(options.range.to) / 1000);

      var useTrendsFrom = Math.ceil(dateMath.parse('now-' + this.trendsFrom) / 1000);
      var useTrends = timeFrom <= useTrendsFrom && this.trends;

      // Create request for each target
      var promises = _lodash2.default.map(options.targets, function (target) {
        // Prevent changes of original object
        target = _lodash2.default.cloneDeep(target);
        _this.replaceTargetVariables(target, options);

        // Apply Time-related functions (timeShift(), etc)
        var timeFunctions = bindFunctionDefs(target.functions, 'Time');
        if (timeFunctions.length) {
          var _sequence = sequence(timeFunctions)([timeFrom, timeTo]);

          var _sequence2 = _slicedToArray(_sequence, 2);

          var time_from = _sequence2[0];
          var time_to = _sequence2[1];

          timeFrom = time_from;
          timeTo = time_to;
        }

        // Metrics or Text query mode
        if (target.mode !== 1) {
          // Migrate old targets
          target = migrations.migrate(target);

          // Don't request undefined and hidden targets
          if (target.hide || !target.group || !target.host || !target.item) {
            return [];
          }

          if (!target.mode || target.mode === 0) {
            return _this.queryNumericData(target, timeFrom, timeTo, useTrends);
          } else if (target.mode === 2) {
            return _this.queryTextData(target, timeFrom, timeTo);
          }
        }

        // IT services mode
        else if (target.mode === 1) {
            // Don't show undefined and hidden targets
            if (target.hide || !target.itservice || !target.slaProperty) {
              return [];
            }

            return _this.zabbix.getSLA(target.itservice.serviceid, timeFrom, timeTo).then(function (slaObject) {
              return _responseHandler2.default.handleSLAResponse(target.itservice, target.slaProperty, slaObject);
            });
          }
      });

      // Data for panel (all targets)
      return Promise.all(_lodash2.default.flatten(promises)).then(_lodash2.default.flatten).then(function (timeseries_data) {
        return downsampleSeries(timeseries_data, options);
      }).then(function (data) {
        return { data: data };
      });
    }
  }, {
    key: 'queryNumericData',
    value: function queryNumericData(target, timeFrom, timeTo, useTrends) {
      var _this2 = this;

      var options = {
        itemtype: 'num'
      };
      return this.zabbix.getItemsFromTarget(target, options).then(function (items) {
        var getHistoryPromise = void 0;

        if (useTrends) {
          (function () {
            var valueType = _this2.getTrendValueType(target);
            getHistoryPromise = _this2.zabbix.getTrend(items, timeFrom, timeTo).then(function (history) {
              return _responseHandler2.default.handleTrends(history, items, valueType);
            });
          })();
        } else {
          // Use history
          getHistoryPromise = _this2.zabbix.getHistory(items, timeFrom, timeTo).then(function (history) {
            return _responseHandler2.default.handleHistory(history, items);
          });
        }

        return getHistoryPromise.then(function (timeseries_data) {
          return _this2.applyDataProcessingFunctions(timeseries_data, target);
        });
      });
    }
  }, {
    key: 'getTrendValueType',
    value: function getTrendValueType(target) {
      // Find trendValue() function and get specified trend value
      var trendFunctions = _lodash2.default.map(metricFunctions.getCategories()['Trends'], 'name');
      var trendValueFunc = _lodash2.default.find(target.functions, function (func) {
        return _lodash2.default.includes(trendFunctions, func.def.name);
      });
      return trendValueFunc ? trendValueFunc.params[0] : "avg";
    }
  }, {
    key: 'applyDataProcessingFunctions',
    value: function applyDataProcessingFunctions(timeseries_data, target) {
      var transformFunctions = bindFunctionDefs(target.functions, 'Transform');
      var aggregationFunctions = bindFunctionDefs(target.functions, 'Aggregate');
      var filterFunctions = bindFunctionDefs(target.functions, 'Filter');
      var aliasFunctions = bindFunctionDefs(target.functions, 'Alias');

      // Apply transformation functions
      timeseries_data = _lodash2.default.map(timeseries_data, function (timeseries) {
        timeseries.datapoints = sequence(transformFunctions)(timeseries.datapoints);
        return timeseries;
      });

      // Apply filter functions
      if (filterFunctions.length) {
        timeseries_data = sequence(filterFunctions)(timeseries_data);
      }

      // Apply aggregations
      if (aggregationFunctions.length) {
        (function () {
          var dp = _lodash2.default.map(timeseries_data, 'datapoints');
          dp = sequence(aggregationFunctions)(dp);

          var aggFuncNames = _lodash2.default.map(metricFunctions.getCategories()['Aggregate'], 'name');
          var lastAgg = _lodash2.default.findLast(target.functions, function (func) {
            return _lodash2.default.includes(aggFuncNames, func.def.name);
          });

          timeseries_data = [{
            target: lastAgg.text,
            datapoints: dp
          }];
        })();
      }

      // Apply alias functions
      _lodash2.default.forEach(timeseries_data, sequence(aliasFunctions));

      // Apply Time-related functions (timeShift(), etc)
      // Find timeShift() function and get specified trend value
      this.applyTimeShiftFunction(timeseries_data, target);

      return timeseries_data;
    }
  }, {
    key: 'applyTimeShiftFunction',
    value: function applyTimeShiftFunction(timeseries_data, target) {
      // Find timeShift() function and get specified interval
      var timeShiftFunc = _lodash2.default.find(target.functions, function (func) {
        return func.def.name === 'timeShift';
      });
      if (timeShiftFunc) {
        (function () {
          var shift = timeShiftFunc.params[0];
          _lodash2.default.forEach(timeseries_data, function (series) {
            series.datapoints = _dataProcessor2.default.unShiftTimeSeries(shift, series.datapoints);
          });
        })();
      }
    }
  }, {
    key: 'queryTextData',
    value: function queryTextData(target, timeFrom, timeTo) {
      var _this3 = this;

      var options = {
        itemtype: 'text'
      };
      return this.zabbix.getItemsFromTarget(target, options).then(function (items) {
        if (items.length) {
          return _this3.zabbix.getHistory(items, timeFrom, timeTo).then(function (history) {
            return _responseHandler2.default.convertHistory(history, items, false, function (point) {
              var value = point.value;

              // Regex-based extractor
              if (target.textFilter) {
                value = extractText(point.value, target.textFilter, target.useCaptureGroups);
              }

              return [value, point.clock * 1000];
            });
          });
        } else {
          return Promise.resolve([]);
        }
      });
    }

    /**
     * Test connection to Zabbix API
     * @return {object} Connection status and Zabbix API version
     */

  }, {
    key: 'testDatasource',
    value: function testDatasource() {
      var _this4 = this;

      var zabbixVersion = void 0;
      return this.zabbix.getVersion().then(function (version) {
        zabbixVersion = version;
        return _this4.zabbix.login();
      }).then(function () {
        return {
          status: "success",
          title: "Success",
          message: "Zabbix API version: " + zabbixVersion
        };
      }).catch(function (error) {
        if (error instanceof _zabbixAPICoreService.ZabbixAPIError) {
          return {
            status: "error",
            title: error.message,
            message: error.data
          };
        } else {
          return {
            status: "error",
            title: "Connection failed",
            message: "Could not connect to given url"
          };
        }
      });
    }

    ////////////////
    // Templating //
    ////////////////

    /**
     * Find metrics from templated request.
     *
     * @param  {string} query Query from Templating
     * @return {string}       Metric name - group, host, app or item or list
     *                        of metrics in "{metric1,metcic2,...,metricN}" format.
     */

  }, {
    key: 'metricFindQuery',
    value: function metricFindQuery(query) {
      var _this5 = this;

      var result = void 0;
      var parts = [];

      // Split query. Query structure: group.host.app.item
      _lodash2.default.each(query.split('.'), function (part) {
        part = _this5.replaceTemplateVars(part, {});

        // Replace wildcard to regex
        if (part === '*') {
          part = '/.*/';
        }
        parts.push(part);
      });
      var template = _lodash2.default.zipObject(['group', 'host', 'app', 'item'], parts);

      // Get items
      if (parts.length === 4) {
        // Search for all items, even it's not belong to any application
        if (template.app === '/.*/') {
          template.app = '';
        }
        result = this.zabbix.getItems(template.group, template.host, template.app, template.item);
      } else if (parts.length === 3) {
        // Get applications
        result = this.zabbix.getApps(template.group, template.host, template.app);
      } else if (parts.length === 2) {
        // Get hosts
        result = this.zabbix.getHosts(template.group, template.host);
      } else if (parts.length === 1) {
        // Get groups
        result = this.zabbix.getGroups(template.group);
      } else {
        result = Promise.resolve([]);
      }

      return result.then(function (metrics) {
        return metrics.map(formatMetric);
      });
    }

    /////////////////
    // Annotations //
    /////////////////

  }, {
    key: 'annotationQuery',
    value: function annotationQuery(options) {
      var _this6 = this;

      var timeFrom = Math.ceil(dateMath.parse(options.rangeRaw.from) / 1000);
      var timeTo = Math.ceil(dateMath.parse(options.rangeRaw.to) / 1000);
      var annotation = options.annotation;
      var showOkEvents = annotation.showOkEvents ? [0, 1] : 1;

      // Show all triggers
      var showTriggers = [0, 1];

      var getTriggers = this.zabbix.getTriggers(this.replaceTemplateVars(annotation.group, {}), this.replaceTemplateVars(annotation.host, {}), this.replaceTemplateVars(annotation.application, {}), showTriggers);

      return getTriggers.then(function (triggers) {

        // Filter triggers by description
        if (utils.isRegex(annotation.trigger)) {
          triggers = _lodash2.default.filter(triggers, function (trigger) {
            return utils.buildRegex(annotation.trigger).test(trigger.description);
          });
        } else if (annotation.trigger) {
          triggers = _lodash2.default.filter(triggers, function (trigger) {
            return trigger.description === annotation.trigger;
          });
        }

        // Remove events below the chose severity
        triggers = _lodash2.default.filter(triggers, function (trigger) {
          return Number(trigger.priority) >= Number(annotation.minseverity);
        });

        var objectids = _lodash2.default.map(triggers, 'triggerid');
        return _this6.zabbix.getEvents(objectids, timeFrom, timeTo, showOkEvents).then(function (events) {
          var indexedTriggers = _lodash2.default.keyBy(triggers, 'triggerid');

          // Hide acknowledged events if option enabled
          if (annotation.hideAcknowledged) {
            events = _lodash2.default.filter(events, function (event) {
              return !event.acknowledges.length;
            });
          }

          return _lodash2.default.map(events, function (event) {
            var tags = void 0;
            if (annotation.showHostname) {
              tags = _lodash2.default.map(event.hosts, 'name');
            }

            // Show event type (OK or Problem)
            var title = Number(event.value) ? 'Problem' : 'OK';

            var formatted_acknowledges = utils.formatAcknowledges(event.acknowledges);
            return {
              annotation: annotation,
              time: event.clock * 1000,
              title: title,
              tags: tags,
              text: indexedTriggers[event.objectid].description + formatted_acknowledges
            };
          });
        });
      });
    }

    // Replace template variables

  }, {
    key: 'replaceTargetVariables',
    value: function replaceTargetVariables(target, options) {
      var _this7 = this;

      var parts = ['group', 'host', 'application', 'item'];
      parts.forEach(function (p) {
        target[p].filter = _this7.replaceTemplateVars(target[p].filter, options.scopedVars);
      });
      target.textFilter = this.replaceTemplateVars(target.textFilter, options.scopedVars);

      _lodash2.default.forEach(target.functions, function (func) {
        func.params = func.params.map(function (param) {
          if (typeof param === 'number') {
            return +_this7.templateSrv.replace(param.toString(), options.scopedVars);
          } else {
            return _this7.templateSrv.replace(param, options.scopedVars);
          }
        });
      });
    }
  }]);

  return ZabbixAPIDatasource;
}();

function bindFunctionDefs(functionDefs, category) {
  var aggregationFunctions = _lodash2.default.map(metricFunctions.getCategories()[category], 'name');
  var aggFuncDefs = _lodash2.default.filter(functionDefs, function (func) {
    return _lodash2.default.includes(aggregationFunctions, func.def.name);
  });

  return _lodash2.default.map(aggFuncDefs, function (func) {
    var funcInstance = metricFunctions.createFuncInstance(func.def, func.params);
    return funcInstance.bindFunction(_dataProcessor2.default.metricFunctions);
  });
}

function downsampleSeries(timeseries_data, options) {
  return _lodash2.default.map(timeseries_data, function (timeseries) {
    if (timeseries.datapoints.length > options.maxDataPoints) {
      timeseries.datapoints = _dataProcessor2.default.groupBy(options.interval, _dataProcessor2.default.AVERAGE, timeseries.datapoints);
    }
    return timeseries;
  });
}

function formatMetric(metricObj) {
  return {
    text: metricObj.name,
    expandable: false
  };
}

/**
 * Custom formatter for template variables.
 * Default Grafana "regex" formatter returns
 * value1|value2
 * This formatter returns
 * (value1|value2)
 * This format needed for using in complex regex with
 * template variables, for example
 * /CPU $cpu_item.*time/ where $cpu_item is system,user,iowait
 */
function zabbixTemplateFormat(value) {
  if (typeof value === 'string') {
    return utils.escapeRegex(value);
  }

  var escapedValues = _lodash2.default.map(value, utils.escapeRegex);
  return '(' + escapedValues.join('|') + ')';
}

/**
 * If template variables are used in request, replace it using regex format
 * and wrap with '/' for proper multi-value work. Example:
 * $variable selected as a, b, c
 * We use filter $variable
 * $variable    -> a|b|c    -> /a|b|c/
 * /$variable/  -> /a|b|c/  -> /a|b|c/
 */
function replaceTemplateVars(templateSrv, target, scopedVars) {
  var replacedTarget = templateSrv.replace(target, scopedVars, zabbixTemplateFormat);
  if (target !== replacedTarget && !utils.isRegex(replacedTarget)) {
    replacedTarget = '/^' + replacedTarget + '$/';
  }
  return replacedTarget;
}

function extractText(str, pattern, useCaptureGroups) {
  var extractPattern = new RegExp(pattern);
  var extractedValue = extractPattern.exec(str);
  if (extractedValue) {
    if (useCaptureGroups) {
      extractedValue = extractedValue[1];
    } else {
      extractedValue = extractedValue[0];
    }
  }
  return extractedValue;
}

// Apply function one by one:
// sequence([a(), b(), c()]) = c(b(a()));
function sequence(funcsArray) {
  return function (result) {
    for (var i = 0; i < funcsArray.length; i++) {
      result = funcsArray[i].call(this, result);
    }
    return result;
  };
}

exports.ZabbixAPIDatasource = ZabbixAPIDatasource;
exports.zabbixTemplateFormat = zabbixTemplateFormat;

// Fix for backward compatibility with lodash 2.4

if (!_lodash2.default.includes) {
  _lodash2.default.includes = _lodash2.default.contains;
}
if (!_lodash2.default.keyBy) {
  _lodash2.default.keyBy = _lodash2.default.indexBy;
}
