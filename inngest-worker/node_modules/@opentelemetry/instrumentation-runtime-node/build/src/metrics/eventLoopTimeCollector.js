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
exports.EventLoopTimeCollector = void 0;
const node_perf_hooks_1 = require("node:perf_hooks");
const baseCollector_1 = require("./baseCollector");
const semconv_1 = require("../semconv");
const { eventLoopUtilization: eventLoopUtilizationCollector } = node_perf_hooks_1.performance;
class EventLoopTimeCollector extends baseCollector_1.BaseCollector {
    updateMetricInstruments(meter) {
        const timeCounter = meter.createObservableCounter(semconv_1.METRIC_NODEJS_EVENTLOOP_TIME, {
            description: 'Cumulative duration of time the event loop has been in each state.',
            unit: 's',
        });
        meter.addBatchObservableCallback(async (observableResult) => {
            if (!this._config.enabled)
                return;
            const data = this.scrape();
            if (data === undefined)
                return;
            observableResult.observe(timeCounter, data.active / 1000, {
                [semconv_1.ATTR_NODEJS_EVENTLOOP_STATE]: semconv_1.NODEJS_EVENTLOOP_STATE_VALUE_ACTIVE,
            });
            observableResult.observe(timeCounter, data.idle / 1000, {
                [semconv_1.ATTR_NODEJS_EVENTLOOP_STATE]: semconv_1.NODEJS_EVENTLOOP_STATE_VALUE_IDLE,
            });
        }, [timeCounter]);
    }
    internalDisable() { }
    internalEnable() { }
    scrape() {
        return eventLoopUtilizationCollector();
    }
}
exports.EventLoopTimeCollector = EventLoopTimeCollector;
//# sourceMappingURL=eventLoopTimeCollector.js.map