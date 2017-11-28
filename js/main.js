const tabs		= [
	{ key: 'A', text: '0 - 50 m&#178' },
	{ key: 'B', text: '51 - 100 m&#178' },
	{ key: 'C', text: '101 - 200 m&#178' },
	{ key: 'D', text: '200+ m&#178' },
];
const plotWidth	= 6;

$( document ).ready(function() {
	d3.select('#barchart-container').selectAll('svg').remove();

	let canvasWidth		= $('#scatter-container').outerWidth(true);
	let canvasHeight	= $('#scatter-container').height();

	let margin 			= { top: 25, right: 130, bottom: 25, left: 25 };
	let width			= canvasWidth - margin.right - margin.left;
	let height			= canvasHeight - margin.top - margin.bottom;

	let x 				= d3.scaleTime().range([0, width]);
	let y 				= d3.scaleLinear().range([height, 0]);
	let colorScale		= d3.scaleLinear().range(["orange", "orange", "orange"]);

	let tab				= _.head(tabs).key;

	let parseTime		= d3.timeParse("%m-%Y");
	let formatTime		= d3.timeFormat("%b-%Y");
	let voronoi			= d3.voronoi().x((o) => (o.x)).y((o) => (y(o.val))).extent([[-1, -1], [width + 1, height + 1]]);
	let line			= d3.line().x((o) => (o.x)).y((o) => (o.y)).curve(d3.curveCatmullRom);
	let underlineProv	= d3.line().x((o) => (o.x)).y((o) => (o.y));

	let activeLine		= [];

	let svg = d3.select("#scatter-container").append("svg")
		.attr('width', width + margin.left + margin.right)
		.attr('height', height + margin.top + margin.bottom)
		.append('g')
		  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

	createTabs();
	createLegend();

	let grouped		= [];

	d3.csv("public/data.csv", (err, raw) => {
		if (err) throw err;

		grouped		= _.chain(raw).groupBy('house_cat').mapValues((o) => (_.map(o, (d) => ({
			prov	: _.kebabCase(d.province_code),
			val		: _.round(parseFloat(d.median)),
			date	: parseTime(d.month + '-' + d.year),
			q25		: _.round(parseFloat(d.q25)),
			q75		: _.round(parseFloat(d.q75)),
		})))).value();

		createChart(grouped[tab]);
	});

	function createChart(data) {
		svg.selectAll("*").remove();

		let provs	= _.chain(data).map('prov').uniq().map((o) => ({ shown: o.split('-').map((d) => (_.includes(['di', 'dki'], d) ? d.toUpperCase() : _.capitalize(d))).join(' '), base: o })).sortBy().value();

		let maxDate	= _.clone(d3.max(data, (d) => (d.date)));
		let minDate	= _.clone(d3.min(data, (d) => (d.date)));

		maxDate.setMonth(maxDate.getMonth() + 1);
		minDate.setMonth(minDate.getMonth() - 1);

		let minData	= d3.min(data, (d) => (d.val));
		let maxData	= d3.max(data, (d) => (d.val));
		let medData	= d3.median(data, (d) => (d.val));

		x.domain([minDate, maxDate]);
		y.domain([minData * 0.75,  maxData * 1.10]);
		colorScale.domain([minData, medData, maxData]);

		let months	= (maxDate.getFullYear() - minDate.getFullYear()) * 12 + maxDate.getMonth() - minDate.getMonth() + 1;
		let space	= width / (months - 1);

		data		= data.map((o) => (_.assign(o, { x : x(o.date) + _.random(-(space / 2), (space / 2)) })))
		let poly	= voronoi(data).polygons();
		data		= data.map((o, i) => (_.assign(o, { poly: poly[i] })))

		svg.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + height + ")")
			.call(d3.axisBottom(x).tickFormat(formatTime));

		svg.append("g")
			.attr("class", "y axis")
			.call(d3.axisLeft(y).ticks(8).tickFormat((o) => (rewriteText(o))).tickSize(-width));

		svg.append("path")
			.attr("id", "crosser")
			.attr("d", "");

		// svg.append("path")
		// 	.attr("id", "underline")
		// 	.attr("d", "");

		let provHeight	= (height / (provs.length));
		svg.append("g").attr("id", "groups-prov").attr("transform", "translate(" + (margin.left + width) + "," + 0 + ")").selectAll("prov").data(provs)
			.enter().append("text")
				.attr("id", (o) => ("txt-" + o.base))
				.attr("class", "prov cursor-pointer")
				.attr("x", "0")
				.attr("y", (o, i) => ( i * provHeight ))
				.text((o) => (o.shown))
				.on('mouseover', (o) => {
					showLine(o.base);

					d3.select('#onhover').classed('hidden', true);
					if (!$( 'div#tooltip' ).hasClass('hidden')) { $( 'div#tooltip' ).addClass('hidden'); };
				})
				.on('mouseout', (o) => {
					d3.select("path#crosser").transition().attr("d", "");
					// d3.select("path#underline").transition().attr("d", "");
					if (!(_.includes(activeLine, o.base) && activeLine.length == 1)) { hideLine(o.base); } else { $( 'text.prov#txt-' + o.base ).removeClass("hover"); }
				})
				.on('click', (o) => {
					showLine(o.base, true);
					showLine(o.base);
				});

		let forced	= svg.append("g").attr("id", "forced-group").selectAll(".forced-group").data(_.chain(data).groupBy('prov').map((val, key) => ({ key, val})).value()).enter().append("g");

		forced.append('path')
			.attr("id", (o) => ("underline-" + o.key))
			.attr("class", "forced-underline hidden")
			.attr("d", (o) => (underlineProv(
				_.chain(o.val).maxBy("x").castArray().map((d) => ({ x: d.x, y: y(d.val) }))
					.concat(_.times(2, (i) => ({ x: (margin.left + width - 10) + (i !== 0 ? margin.right : 0), y: parseFloat($( '#txt-' + o.key ).attr('y')) + 5 })))
					.value()
			)));

		forced.append('path')
			.attr("id", (o) => ("cross-" + o.key))
			.attr("class", "forced-cross hidden")
			.attr("d", (o) => (line(o.val.map((d) => ({ x: d.x, y: y(d.val) })))));

		svg.append('circle')
			.attr("id", "onhover")
			.attr("class", "hidden")
			.attr("r", 7);

		let groupCircle	= svg.append("g").attr('id', 'dot-crowd').selectAll(".group-circle").data(data).enter().append("g")

		groupCircle.append("circle")
			.attr("class", (o) => (o.prov + " dot"))
			.attr("r", 3)
			.attr("fill", (o) => (colorScale(o.val)))
			.attr("cx", (o) => (o.x))
			.attr("cy", (o) => (y(o.val)));

		groupCircle.append("path")
			.attr("class", "polygons")
			.attr("d", (o) => (o.poly ? "M" + o.poly.join("L") + "Z" : null));

		groupCircle.append("line")
			.attr("class", (o) => ("hidden plot " + o.prov))
			.attr("x1", (o) => (o.x))
			.attr("y1", (o) => (y(o.q25)))
			.attr("x2", (o) => (o.x))
			.attr("y2", (o) => (y(o.q75)));

		groupCircle.append("line")
			.attr("class", (o) => ("hidden plot " + o.prov))
			.attr("x1", (o) => (o.x - plotWidth))
			.attr("y1", (o) => (y(o.q25)))
			.attr("x2", (o) => (o.x + plotWidth))
			.attr("y2", (o) => (y(o.q25)));

		groupCircle.append("line")
			.attr("class", (o) => ("hidden plot " + o.prov))
			.attr("x1", (o) => (o.x - plotWidth))
			.attr("y1", (o) => (y(o.q75)))
			.attr("x2", (o) => (o.x + plotWidth))
			.attr("y2", (o) => (y(o.q75)));

		groupCircle.append("text")
			.attr("class", (o) => ("hidden detil " + o.prov))
			.attr("x", (o) => (o.x - 10))
			.attr("y", (o) => (y(o.q25) + 10))
			.text((o) => (o.val !== o.q25 ? rewriteText(o.q25) : ""));

		groupCircle.append("text")
			.attr("class", (o) => ("hidden detil " + o.prov))
			.attr("x", (o) => (o.x - 10))
			.attr("y", (o) => (y(o.q75) - 5))
			.text((o) => (o.val !== o.q75 ? rewriteText(o.q75) : ""));

		groupCircle.append("text")
			.attr("class", (o) => ("hidden detil " + o.prov))
			.attr("x", (o) => (o.x - 10))
			.attr("y", (o) => (o.q75 == o.val ? y(o.q75) - 12 : (o.q25 == o.val ? y(o.q25) + 17 : y(o.val))))
			.text((o) => (_.includes([o.q25, o.q75], o.val) ? rewriteText(o.val) : ""));

		groupCircle
			.on('mouseover', (o) => {
				if ((_.includes(activeLine, o.prov)) || activeLine.length == 0) {
					d3.select('#onhover')
						.attr('cx', o.x)
						.attr('cy', y(o.val));

					$( 'div#tooltip' ).css({ left: o.x - 7, top: y(o.val) - 20 }).html(formatTime(o.date) + '<br />' + rewriteText(o.val));

					if ($( 'div#tooltip' ).hasClass('hidden') && activeLine.length) { $( 'div#tooltip' ).removeClass('hidden'); };
					d3.select('#onhover').classed('hidden', false);
				}

				if (activeLine.length == 0) {
					showLine(o.prov);
				}
			})
			.on('mouseout', (o) => {
				if (activeLine.length == 0) { hideLine(o.prov); }
			})
			.on('click', (o) => {
				if (activeLine.length == 0) {
					showLine(o.prov, true);
					if ($( 'div#tooltip' ).hasClass('hidden') && activeLine.length) { $( 'div#tooltip' ).removeClass('hidden'); };
				} else if (activeLine.length == 1) {
					showLine(_.head(activeLine), true);

					d3.select('#onhover').attr('cx', o.x).attr('cy', y(o.val));
					$( 'div#tooltip' ).css({ left: o.x - 7, top: y(o.val) - 20 }).html(formatTime(o.date) + '<br />' + rewriteText(o.val));
					showLine(o.prov);
				} else {
					if (_.includes(activeLine, o.prov)) { showLine(o.prov, true); }
					$( 'div#tooltip, #onhover' ).addClass('hidden');
				}
			});

		d3.select('#scatter-container').on('mouseleave', () => {
			d3.select('#onhover').classed('hidden', true);
			d3.select('#tooltip').classed('hidden', true);
			d3.select("path#crosser").transition().attr("d", "");
			// d3.select("path#underline").transition().attr("d", "");
		})
	}

	function rewriteText(o) { return (_.round((o / 1000000), 1) + "jt"); }

	function hideLine(prov) {
		$( 'line.plot.' + prov ).addClass('hidden');
		$( 'text.detil.' + prov ).addClass('hidden');
		$( 'circle.dot.' + (prov) ).addClass('unintended');
		$( 'text.prov#txt-' + prov ).removeClass("hover");
		if (activeLine.length == 0) { $( 'circle.dot:not(.' + (prov) + ')' ).removeClass('unintended'); }
	};

	function showLine(prov, forced) {
		if (forced) {
			if (_.includes(activeLine, prov)) {
				_.pull(activeLine, prov);
				d3.select( 'path#cross-' + prov ).classed('hidden', true);
				d3.select( 'path#underline-' + prov ).classed('hidden', true);
				$( 'text.prov#txt-' + prov ).removeClass("selected");
			} else {
				activeLine.push(prov);
				d3.select( 'path#cross-' + prov ).classed('hidden', false);
				d3.select( 'path#underline-' + prov ).classed('hidden', false);
				$( 'text.prov#txt-' + prov ).addClass("selected");
			}

			$( 'circle.dot:not(' + activeLine.map((o) => ('.' + o)).join(', ') + ')' ).addClass('unintended');
			$( activeLine.map((o) => ('circle.dot.' + o)).join(', ') ).removeClass('unintended');

			if (activeLine.length == 1) {
				$( 'line.plot.' + _.head(activeLine) ).removeClass('hidden');
				$( 'text.detil.' + _.head(activeLine) ).removeClass('hidden');
			} else if (activeLine.length == 0) {
				// $( 'circle.dot' ).removeClass('unintended');
				$( 'line.plot:not(.hidden)').addClass('hidden');
				$( 'text.detil:not(.hidden)').addClass('hidden');

				if (!$( 'div#tooltip' ).hasClass('hidden')) { $( 'div#tooltip' ).addClass('hidden'); };
				$( 'circle.dot.' + prov ).removeClass('unintended');
			} else {
				$( activeLine.map((o) => ('line.plot.' + o) + ':not(.hidden)').join(', ') ).addClass('hidden');
				$( activeLine.map((o) => ('text.detil.' + o) + ':not(.hidden)').join(', ') ).addClass('hidden');
			}

		} else {
			$( 'circle.dot:not(' + activeLine.concat([prov]).map((d) => '.' + d).join(', ') + ')' ).addClass('unintended');
			$( activeLine.concat([prov]).map((d) => 'circle.dot.' + d).join(', ') ).removeClass('unintended');

			// let addtn	= [{ x: (margin.left + width - 10), y: parseFloat($( '#txt-' + prov ).attr('y')) + 5 }];
			let path	= _.chain($( '.dot.' + prov ).map(function(o) { return ({ x: parseFloat($(this).attr('cx')), y: parseFloat($(this).attr('cy')) }) })).sortBy('x').value();

			let undrln	= _.times(2, (i) => ({ x: (margin.left + width - 10) + (i !== 0 ? margin.right : 0), y: parseFloat($( '#txt-' + prov ).attr('y')) + 5 }));

			d3.select("path#crosser").transition().attr("d", line(path));
			$("text.prov#txt-" + prov).addClass("hover");
			// d3.select("path#underline").transition().attr("d", underlineProv([_.last(path)].concat(undrln)));

			$( 'line.plot.' + prov ).removeClass('hidden');
			$( 'text.detil.' + prov ).removeClass('hidden');
		}
	}

	function createLegend() {
		let legend	= d3.select("#legend-container").append("svg").attr('transform', 'translate(' + margin.left + ',' + (0) + ')');

		let iqr		= legend.append('g');
		let iqrWdth	= 50;
		iqr.append("line").attr("x1", 1).attr("y1", 0).attr("x2", 1).attr("y2", plotWidth * 2);
		iqr.append("line").attr("x1", iqrWdth).attr("y1", 0).attr("x2", iqrWdth).attr("y2", plotWidth * 2);
		iqr.append("line").attr("x1", 1).attr("y1", plotWidth).attr("x2", iqrWdth).attr("y2", plotWidth);
		iqr.append("text").attr("y", plotWidth * 1.75).attr("x", (iqrWdth + 10)).text("interquartile range");

		let circle	= legend.append('g');
		let crclStr	= 185;
		circle.append("circle").attr("r", 6).attr('fill', 'orange').attr("cx", crclStr).attr("cy", (plotWidth + 1));
		iqr.append("text").attr("y", plotWidth * 1.75).attr("x", (crclStr + 12.5)).text("median");
	}

	function createTabs() {
		$( '#tabs' ).html(tabs.map((o) => ("<li id='tab-" + o.key + "' class='cursor-pointer " + (o.key == tab ? 'active' : '') + "' value='" + o.key + "'>" + o.text + "</li>")));
	}

	$( "ul#tabs > li" ).click(function() {
		$( "ul#tabs > li.active" ).removeClass('active');
		$( this ).addClass('active');
		activeLine	= [];

		createChart(grouped[$( this ).attr('value')])
	})
});
