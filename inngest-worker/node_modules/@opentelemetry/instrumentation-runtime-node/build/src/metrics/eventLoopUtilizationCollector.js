"use strict";
/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventLoopUtilizationCollector = void 0;
const node_perf_hooks_1 = require("node:perf_hooks");
const baseCollector_1 = require("./baseCollector");
const semconv_1 = require("../semconv");
const { eventLoopUtilization: eventLoopUtilizationCollector } = node_perf_hooks_1.performance;
class EventLoopUtilizationCollector extends baseCollector_1.BaseCollector {
    // Value needs to be initialized the first time otherwise the first measurement would always be 1
    // See https://github.com/open-telemetry/opentelemetry-js-contrib/pull/3118#issuecomment-3429737955
    _lastValue = eventLoopUtilizationCollector();
    updateMetricInstruments(meter) {
        meter
            .createObservableGauge(semconv_1.METRIC_NODEJS_EVENTLOOP_UTILIZATION, {
            description: 'Event loop utilization',
            unit: '1',
        })
            .addCallback(async (observableResult) => {
            if (!this._config.enabled)
                return;
            const currentELU = eventLoopUtilizationCollector();
            const deltaELU = eventLoopUtilizationCollector(currentELU, this._lastValue);
            this._lastValue = currentELU;
            observableResult.observe(deltaELU.utilization);
        });
    }
    internalDisable() { }
    internalEnable() { }
}
exports.EventLoopUtilizationCollector = EventLoopUtilizationCollector;
//# sourceMappingURL=eventLoopUtilizationCollector.js.map