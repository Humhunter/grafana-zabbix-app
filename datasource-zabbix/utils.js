'use strict';

System.register(['lodash', 'moment'], function (_export, _context) {
  var _, moment, regexPattern;

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_moment) {
      moment = _moment.default;
    }],
    execute: function () {

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

      _export('expandItemName', expandItemName);

      _export('regexPattern', regexPattern = /^\/(.*)\/([gmi]*)$/m);

      _export('regexPattern', regexPattern);

      function isRegex(str) {
        return regexPattern.test(str);
      }

      _export('isRegex', isRegex);

      function buildRegex(str) {
        var matches = str.match(regexPattern);
        var pattern = matches[1];
        var flags = matches[2] !== "" ? matches[2] : undefined;
        return new RegExp(pattern, flags);
      }

      // Need for template variables replace
      // From Grafana's templateSrv.js

      _export('buildRegex', buildRegex);

      function escapeRegex(value) {
        return value.replace(/[\\^$*+?.()|[\]{}\/]/g, '\\$&');
      }

      _export('escapeRegex', escapeRegex);

      function parseInterval(interval) {
        var intervalPattern = /(^[\d]+)(y|M|w|d|h|m|s)/g;
        var momentInterval = intervalPattern.exec(interval);
        return moment.duration(Number(momentInterval[1]), momentInterval[2]).valueOf();
      }

      /**
       * Format acknowledges.
       *
       * @param  {array} acknowledges array of Zabbix acknowledge objects
       * @return {string} HTML-formatted table
       */

      _export('parseInterval', parseInterval);

      function formatAcknowledges(acknowledges) {
        if (acknowledges.length) {
          var formatted_acknowledges = '<br><br>Acknowledges:<br><table><tr><td><b>Time</b></td>' + '<td><b>User</b></td><td><b>Comments</b></td></tr>';
          _.each(_.map(acknowledges, function (ack) {
            var timestamp = moment.unix(ack.clock);
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

      _export('formatAcknowledges', formatAcknowledges);

      function convertToZabbixAPIUrl(url) {
        var zabbixAPIUrlPattern = /.*api_jsonrpc.php$/;
        var trimSlashPattern = /(.*?)[\/]*$/;
        if (url.match(zabbixAPIUrlPattern)) {
          return url;
        } else {
          return url.replace(trimSlashPattern, "$1");
        }
      }

      _export('convertToZabbixAPIUrl', convertToZabbixAPIUrl);
    }
  };
});
//# sourceMappingURL=utils.js.map
