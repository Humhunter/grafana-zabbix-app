'use strict';

System.register(['lodash', '../datasource-zabbix/utils', '../datasource-zabbix/css/query-editor.css!'], function (_export, _context) {
  var _, utils, _createClass, TriggerPanelEditorCtrl;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  // Get list of metric names for bs-typeahead directive
  function getMetricNames(scope, metricList) {
    return _.uniq(_.map(scope.metric[metricList], 'name'));
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_datasourceZabbixUtils) {
      utils = _datasourceZabbixUtils;
    }, function (_datasourceZabbixCssQueryEditorCss) {}],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      TriggerPanelEditorCtrl = function () {

        /** @ngInject */

        function TriggerPanelEditorCtrl($scope, $rootScope, uiSegmentSrv, datasourceSrv, templateSrv, popoverSrv) {
          var _this = this;

          _classCallCheck(this, TriggerPanelEditorCtrl);

          $scope.editor = this;
          this.panelCtrl = $scope.ctrl;
          this.panel = this.panelCtrl.panel;

          this.datasourceSrv = datasourceSrv;
          this.templateSrv = templateSrv;
          this.popoverSrv = popoverSrv;

          // Map functions for bs-typeahead
          this.getGroupNames = _.partial(getMetricNames, this, 'groupList');
          this.getHostNames = _.partial(getMetricNames, this, 'hostList');
          this.getApplicationNames = _.partial(getMetricNames, this, 'appList');

          // Update metric suggestion when template variable was changed
          $rootScope.$on('template-variable-value-updated', function () {
            return _this.onVariableChange();
          });

          this.ackFilters = ['all triggers', 'unacknowledged', 'acknowledged'];

          this.sortByFields = [{ text: 'last change', value: 'lastchange' }, { text: 'severity', value: 'priority' }];

          this.showEventsFields = [{ text: 'All', value: [0, 1] }, { text: 'OK', value: [0] }, { text: 'Problems', value: 1 }];

          // Load scope defaults
          var scopeDefaults = {
            metric: {},
            inputStyles: {},
            oldTarget: _.cloneDeep(this.panel.triggers)
          };
          _.defaults(this, scopeDefaults);

          // Get zabbix data sources
          var datasources = _.filter(this.datasourceSrv.getMetricSources(), function (datasource) {
            return datasource.meta.id === 'alexanderzobnin-zabbix-datasource';
          });
          this.datasources = _.map(datasources, 'name');

          // Set default datasource
          if (!this.panel.datasource) {
            this.panel.datasource = this.datasources[0];
          }
          // Load datasource
          this.datasourceSrv.get(this.panel.datasource).then(function (datasource) {
            _this.datasource = datasource;
            _this.queryBuilder = datasource.queryBuilder;
            _this.initFilters();
            _this.panelCtrl.refresh();
          });
        }

        _createClass(TriggerPanelEditorCtrl, [{
          key: 'initFilters',
          value: function initFilters() {
            return Promise.all([this.suggestGroups(), this.suggestHosts(), this.suggestApps()]);
          }
        }, {
          key: 'suggestGroups',
          value: function suggestGroups() {
            var _this2 = this;

            return this.queryBuilder.getAllGroups().then(function (groups) {
              _this2.metric.groupList = groups;
              return groups;
            });
          }
        }, {
          key: 'suggestHosts',
          value: function suggestHosts() {
            var _this3 = this;

            var groupFilter = this.datasource.replaceTemplateVars(this.panel.triggers.group.filter);
            return this.queryBuilder.getAllHosts(groupFilter).then(function (hosts) {
              _this3.metric.hostList = hosts;
              return hosts;
            });
          }
        }, {
          key: 'suggestApps',
          value: function suggestApps() {
            var _this4 = this;

            var groupFilter = this.datasource.replaceTemplateVars(this.panel.triggers.group.filter);
            var hostFilter = this.datasource.replaceTemplateVars(this.panel.triggers.host.filter);
            return this.queryBuilder.getAllApps(groupFilter, hostFilter).then(function (apps) {
              _this4.metric.appList = apps;
              return apps;
            });
          }
        }, {
          key: 'onVariableChange',
          value: function onVariableChange() {
            if (this.isContainsVariables()) {
              this.targetChanged();
            }
          }
        }, {
          key: 'isContainsVariables',
          value: function isContainsVariables() {
            var self = this;
            return _.some(self.templateSrv.variables, function (variable) {
              return _.some(['group', 'host', 'application'], function (field) {
                return self.templateSrv.containsVariable(self.panel.triggers[field].filter, variable.name);
              });
            });
          }
        }, {
          key: 'targetChanged',
          value: function targetChanged() {
            this.initFilters();
            this.panelCtrl.refresh();
          }
        }, {
          key: 'parseTarget',
          value: function parseTarget() {
            this.initFilters();
            var newTarget = _.cloneDeep(this.panel.triggers);
            if (!_.isEqual(this.oldTarget, this.panel.triggers)) {
              this.oldTarget = newTarget;
              this.panelCtrl.refresh();
            }
          }
        }, {
          key: 'refreshTriggerSeverity',
          value: function refreshTriggerSeverity() {
            _.each(this.triggerList, function (trigger) {
              trigger.color = this.panel.triggerSeverity[trigger.priority].color;
              trigger.severity = this.panel.triggerSeverity[trigger.priority].severity;
            });
            this.panelCtrl.refresh();
          }
        }, {
          key: 'datasourceChanged',
          value: function datasourceChanged() {
            this.panelCtrl.refresh();
          }
        }, {
          key: 'changeTriggerSeverityColor',
          value: function changeTriggerSeverityColor(trigger, color) {
            this.panel.triggerSeverity[trigger.priority].color = color;
            this.refreshTriggerSeverity();
          }
        }, {
          key: 'isRegex',
          value: function isRegex(str) {
            return utils.isRegex(str);
          }
        }, {
          key: 'isVariable',
          value: function isVariable(str) {
            return utils.isTemplateVariable(str, this.templateSrv.variables);
          }
        }]);

        return TriggerPanelEditorCtrl;
      }();

      function triggerPanelEditor() {
        return {
          restrict: 'E',
          scope: true,
          templateUrl: 'public/plugins/alexanderzobnin-zabbix-app/panel-triggers/editor.html',
          controller: TriggerPanelEditorCtrl
        };
      }

      _export('triggerPanelEditor', triggerPanelEditor);
    }
  };
});
//# sourceMappingURL=editor.js.map
