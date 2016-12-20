'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.regexPattern = undefined;
exports.expandItemName = expandItemName;
exports.isRegex = isRegex;
exports.isTemplateVariable = isTemplateVariable;
exports.buildRegex = buildRegex;
exports.escapeRegex = escapeRegex;
exports.parseInterval = parseInterval;
exports.parseTimeShiftInterval = parseTimeShiftInterval;
exports.formatAcknowledges = formatAcknowledges;
exports.convertToZabbixAPIUrl = convertToZabbixAPIUrl;
exports.callOnce = callOnce;

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Expand Zabbix item name
 *
 * @param  {string} name item name, ie "CPU $2 time"
 * @param  {string} key  item key, ie system.cpu.util[,system,avg1]
 * @return {string}      expanded name, ie "CPU system time"
 */
function expandItemName(name, key) {

  // extract params from key:
  // "system.cpu.util[,system,avg1]" --> ["", "system", "avg1"]
  var key_params = key.substring(key.indexOf('[') + 1, key.lastIndexOf(']')).split(',');

  // replace item parameters
  for (var i = key_params.length; i >= 1; i--) {
    name = name.replace('$' + i, key_params[i - 1]);
  }
  return name;
}

// Pattern for testing regex
var regexPattern = exports.regexPattern = /^\/(.*)\/([gmi]*)$/m;

function isRegex(str) {
  return regexPattern.test(str);
}

function isTemplateVariable(str, templateVariables) {
  var variablePattern = /^\$\w+/;
  if (variablePattern.test(str)) {
    var variables = _lodash2.default.map(templateVariables, function (variable) {
      return '$' + variable.name;
    });
    return _lodash2.default.includes(variables, str);
  } else {
    return false;
  }
}

function buildRegex(str) {
  var matches = str.match(regexPattern);
  var pattern = matches[1];
  var flags = matches[2] !== "" ? matches[2] : undefined;
  return new RegExp(pattern, flags);
}

// Need for template variables replace
// From Grafana's templateSrv.js
function escapeRegex(value) {
  return value.replace(/[\\^$*+?.()|[\]{}\/]/g, '\\$&');
}

function parseInterval(interval) {
  var intervalPattern = /(^[\d]+)(y|M|w|d|h|m|s)/g;
  var momentInterval = intervalPattern.exec(interval);
  return _moment2.default.duration(Number(momentInterval[1]), momentInterval[2]).valueOf();
}

function parseTimeShiftInterval(interval) {
  var intervalPattern = /^([\+\-]*)([\d]+)(y|M|w|d|h|m|s)/g;
  var momentInterval = intervalPattern.exec(interval);
  var duration = 0;

  if (momentInterval[1] === '+') {
    duration = 0 - _moment2.default.duration(Number(momentInterval[2]), momentInterval[3]).valueOf();
  } else {
    duration = _moment2.default.duration(Number(momentInterval[2]), momentInterval[3]).valueOf();
  }

  return duration;
}

/**
 * Format acknowledges.
 *
 * @param  {array} acknowledges array of Zabbix acknowledge objects
 * @return {string} HTML-formatted table
 */
function formatAcknowledges(acknowledges) {
  if (acknowledges.length) {
    var formatted_acknowledges = '<br><br>Acknowledges:<br><table><tr><td><b>Time</b></td>' + '<td><b>User</b></td><td><b>Comments</b></td></tr>';
    _lodash2.default.each(_lodash2.default.map(acknowledges, function (ack) {
      var timestamp = _moment2.default.unix(ack.clock);
      return '<tr><td><i>' + timestamp.format("DD MMM YYYY HH:mm:ss") + '</i></td><td>' + ack.alias + ' (' + ack.name + ' ' + ack.surname + ')' + '</td><td>' + ack.message + '</td></tr>';
    }), function (ack) {
      formatted_acknowledges = formatted_acknowledges.concat(ack);
    });
    formatted_acknowledges = formatted_acknowledges.concat('</table>');
    return formatted_acknowledges;
  } else {
    return '';
  }
}

function convertToZabbixAPIUrl(url) {
  var zabbixAPIUrlPattern = /.*api_jsonrpc.php$/;
  var trimSlashPattern = /(.*?)[\/]*$/;
  if (url.match(zabbixAPIUrlPattern)) {
    return url;
  } else {
    return url.replace(trimSlashPattern, "$1");
  }
}

/**
 * Wrap function to prevent multiple calls
 * when waiting for result.
 */
function callOnce(func, promiseKeeper) {
  return function () {
    if (!promiseKeeper) {
      promiseKeeper = Promise.resolve(func.apply(this, arguments).then(function (result) {
        promiseKeeper = null;
        return result;
      }));
    }
    return promiseKeeper;
  };
}

// Fix for backward compatibility with lodash 2.4
if (!_lodash2.default.includes) {
  _lodash2.default.includes = _lodash2.default.contains;
}
