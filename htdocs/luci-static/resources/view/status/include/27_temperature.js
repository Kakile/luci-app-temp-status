'use strict';
'require baseclass';
'require rpc';

document.head.append(E('style', { 'type': 'text/css' },
`
:root {
	--app-temp-status-font-color: #2e2e2e;
	--app-temp-status-hot-color: #fff7e2;
	--app-temp-status-overheat-color: #ffe9e8;
}
:root[data-darkmode="true"] {
	--app-temp-status-font-color: #fff;
	--app-temp-status-hot-color: #8d7000;
	--app-temp-status-overheat-color: #a93734;
}
.temp-status-hot {
	background-color: var(--app-temp-status-hot-color) !important;
	color: var(--app-temp-status-font-color) !important;
}
.temp-status-hot .td {
	color: var(--app-temp-status-font-color) !important;
}
.temp-status-hot td {
	color: var(--app-temp-status-font-color) !important;
}
.temp-status-overheat {
	background-color: var(--app-temp-status-overheat-color) !important;
	color: var(--app-temp-status-font-color) !important;
}
.temp-status-overheat .td {
	color: var(--app-temp-status-font-color) !important;
}
.temp-status-overheat td {
	color: var(--app-temp-status-font-color) !important;
}
`));

return baseclass.extend({
	title       : _('Temperature'),

	viewName    : 'temp-status',

	tempHot     : 95,
	tempOverheat: 105,

	sensorsData : null,
	tempData    : null,
	sensorsPath : [],

	// 持久容器引用
	section     : null,

	tempTable   : E('table', { 'class': 'table' }),

	callSensors : rpc.declare({
		object: 'luci.temp-status',
		method: 'getSensors',
		expect: { '': {} },
	}),

	callTempData: rpc.declare({
		object: 'luci.temp-status',
		method: 'getTempData',
		params: [ 'tpaths' ],
		expect: { '': {} },
	}),

	formatTemp(mc) {
		return Number((mc / 1000).toFixed(1));
	},

	sortFunc(a, b) {
		return (a.number > b.number) ? 1 : (a.number < b.number) ? -1 : 0;
	},

	makeTempTableContent() {
		this.tempTable.innerHTML = '';

		// 表头：Sensor
		this.tempTable.append(
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th left', 'width': '50%' }, _('Sensor')),
				E('th', { 'class': 'th left' }, _('Temperature')),
			])
		);

		if (this.sensorsData && this.tempData) {
			for (let [k, v] of Object.entries(this.sensorsData)) {
				v.sort(this.sortFunc);

				for (let i of Object.values(v)) {
					let sensor = i.title || i.item;

					if (i.sources === undefined) continue;

					i.sources.sort(this.sortFunc);

					for (let j of i.sources) {
						let temp = this.tempData[j.path];
						let name = (j.label !== undefined) ? sensor + " / " + j.label :
							(j.item !== undefined) ? sensor + " / " + j.item.replace(/_input$/, "") : sensor;

						if (temp !== undefined && temp !== null) {
							temp = this.formatTemp(temp);
						}

						let tempHot       = NaN;
						let tempOverheat  = NaN;
						let tpoints       = j.tpoints;
						let tpointsString = '';

						if (tpoints) {
							for (let i of Object.values(tpoints)) {
								let t = this.formatTemp(i.temp);
								tpointsString += `&#10;${i.type}: ${t} °C`;

								if (i.type == 'max' || i.type == 'critical' || i.type == 'emergency') {
									if (!(tempOverheat <= t)) {
										tempOverheat = t;
									}
								}
								else if (i.type == 'hot') {
									tempHot = t;
								}
							}
						}

						if (isNaN(tempHot) && isNaN(tempOverheat)) {
							tempHot      = this.tempHot;
							tempOverheat = this.tempOverheat;
						}

						let rowStyle = (temp >= tempOverheat) ? ' temp-status-overheat' :
							(temp >= tempHot) ? ' temp-status-hot' : '';

						this.tempTable.append(
							E('tr', {
								'class'    : 'tr' + rowStyle,
								'data-path': j.path ,
							}, [
								E('td', {
										'class'     : 'td left',
										'data-title': _('Sensor')
									},
									(tpointsString.length > 0) ?
									`<span style="cursor:help; border-bottom:1px dotted" data-tooltip="${tpointsString}">${name}</span>` :
									name
								),
								E('td', {
										'class'     : 'td left',
										'data-title': _('Temperature')
									},
									(temp === undefined || temp === null) ? '-' : temp + ' °C'
								),
							])
						);
					}
				}
			}
		}

		if (this.tempTable.childNodes.length == 1) {
			this.tempTable.append(
				E('tr', { 'class': 'tr placeholder' },
					E('td', { 'class': 'td' },
						E('em', {}, _('No temperature sensors available'))
					)
				)
			);
		}
	},

	load() {
		if (this.sensorsData) {
			return (this.sensorsPath.length > 0) ?
				L.resolveDefault(this.callTempData(this.sensorsPath), null) :
				Promise.resolve(null);
		} else {
			return L.resolveDefault(this.callSensors(), null);
		}
	},

	render(data) {
		if (data) {
			if (!this.sensorsData) {
				this.sensorsData = data.sensors;
				this.sensorsPath = data.temp && new Array(...Object.keys(data.temp));
			}
			this.tempData = data.temp;
		}

		if (!this.sensorsData || !this.tempData) {
			return;
		}

		// 创建并持久化 section 容器引用
		if (!this.section) {
			this.section = E('div', { 'class': 'cbi-section' }, [ this.tempTable ]);
		}

		// 渲染表格
		this.makeTempTableContent();

		return this.section;
	}
});
