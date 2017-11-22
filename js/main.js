$( document ).ready(function() {
	d3.select('#barchart-container').selectAll('svg').remove();

	let canvasWidth		= $('#scatter-container').outerWidth(true);
	let canvasHeight	= $('#scatter-container').height();

	let margin 			= { top: 25, right: 50, bottom: 25, left: 125 };
	let width			= canvasWidth - margin.right - margin.left;
	let height			= canvasHeight - margin.top - margin.bottom;

	let x 				= d3.scaleTime().range([0, width]);
	let y 				= d3.scaleLinear().range([height, 0]);
	let colorScale		= d3.scaleLinear().range(["orange", "orange", "orange"]);

	let tabs			= ['A', 'B', 'C', 'D'];
	let tab				= _.head(tabs);

	let parseTime		= d3.timeParse("%m-%Y");
	let voronoi			= d3.voronoi().x((o) => (o.x)).y((o) => (y(o.val))).extent([[-1, -1], [width + 1, height + 1]]);
	let line			= d3.line().x((o) => (o.x)).y((o) => (o.y)).curve(d3.curveCatmullRom);
	let underlineProv	= d3.line().x((o) => (o.x)).y((o) => (o.y));

	let activeLine		= [];
	let plotWidth		= 6;

	let svg = d3.select("#scatter-container").append("svg")
		.attr('width', width + margin.left + margin.right)
		.attr('height', height + margin.top + margin.bottom)
		.append('g')
		  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

	svg.append("path")
		.attr("id", "crosser")
		.attr("d", "");

	svg.append("path")
		.attr("id", "underline")
		.attr("d", "");

	d3.csv("public/data.csv", (err, raw) => {
		if (err) throw err;

		let grouped	= _.chain(raw).groupBy('house_cat').mapValues((o) => (_.map(o, (d) => ({
			prov	: _.kebabCase(d.province_code),
			val		: _.round(parseFloat(d.median)),
			date	: parseTime(d.month + '-' + d.year),
			q25		: _.round(parseFloat(d.q25)),
			q75		: _.round(parseFloat(d.q75)),
		})))).value();

		let data	= grouped[tab];
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
			.call(d3.axisBottom(x).tickFormat(d3.timeFormat("%b-%Y")));

		svg.append("g")
			.attr("class", "y axis")
			.attr("transform", "translate(" + width + "," + 0 + ")")
			.call(d3.axisRight(y).ticks(8).tickFormat((o) => ((o / 1000000) + "jt")).tickSize(-width));

		let provHeight	= (height / (provs.length));
		svg.append("g").attr("transform", "translate(" + (-15) + "," + 0 + ")").selectAll("prov").data(provs)
			.enter().append("text")
				.attr("id", (o) => ("txt-" + o.base))
				.attr("class", "prov cursor-pointer")
				.attr("x", "0")
				.attr("y", (o, i) => ( i * provHeight ))
				.text((o) => (o.shown))
				// .on("mouseover", (o) => {
				// 	showLine(o.base);
				// })
				// .on('mouseleave', (o) => { $( 'line.plot.' + o.base ).addClass('hidden'); })
				.on('click', (o) => { showLine(o.base, true); });

		let forced	= svg.append("g").attr("id", "forced-group").selectAll(".forced-group").data(_.chain(data).groupBy('prov').map((val, key) => ({ key, val})).value()).enter().append("g");

		forced.append('path')
			.attr("id", (o) => ("underline-" + o.key))
			.attr("class", "forced-underline hidden")
			.attr("d", (o) => (underlineProv(_.times(2, (i) => ({ x: -10 - (i == 0 ? 0 : margin.left), y: parseFloat($( '#txt-' + o.key ).attr('y')) + 5 })))));

		forced.append('path')
			.attr("id", (o) => ("cross-" + o.key))
			.attr("class", "forced-cross hidden")
			.attr("d", (o) => (line([{ x: -10, y: parseFloat($( '#txt-' + o.key ).attr('y')) + 5 }].concat(o.val.map((d) => ({ x: d.x, y: y(d.val) }))))));

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

		groupCircle
			.on('mouseover', (o) => {
				d3.select('#onhover')
					.attr('cx', o.x)
					.attr('cy', y(o.val))

				showLine(o.prov);
				d3.select('#onhover').classed('hidden', false);
				$( 'circle.dot:not(.' + o.prov + '), path.forced-cross, path.forced-underline' ).addClass('unintended');
			})
			.on('mouseout', (o) => { $( 'line.plot.' + o.prov ).addClass('hidden'); $( 'circle.dot, path.forced-cross, path.forced-underline' ).removeClass('unintended'); })
			.on('click', (o) => { showLine(o.prov, true); });

		svg.on('mouseleave', () => { d3.select('#onhover').classed('hidden', true); d3.select("path#crosser").transition().attr("d", ""); d3.select("path#underline").transition().attr("d", ""); })
	});

	function showLine(prov, forced) {
		if (forced) {
			if (_.includes(activeLine, prov)) {
				_.pull(activeLine, prov);
				d3.select( 'path#cross-' + prov ).classed('hidden', true);
				d3.select( 'path#underline-' + prov ).classed('hidden', true);
			} else {
				activeLine.push(prov);
				d3.select( 'path#cross-' + prov ).classed('hidden', false);
				d3.select( 'path#underline-' + prov ).classed('hidden', false);
			}
		} else {
			let addtn	= [{ x: -10, y: parseFloat($( '#txt-' + prov ).attr('y')) + 5 }];
			let path	= _.chain($( '.dot.' + prov ).map(function(o) { return ({ x: parseFloat($(this).attr('cx')), y: parseFloat($(this).attr('cy')) }) })).sortBy('x').value();

			let undrln	= _.times(2, (i) => ({ x: -10 - (i == 0 ? 0 : margin.left), y: parseFloat($( '#txt-' + prov ).attr('y')) + 5 }));

			d3.select("path#crosser").transition().attr("d", line(addtn.concat(path)));
			d3.select("path#underline").transition().attr("d", underlineProv(undrln));

			$( 'line.plot.' + prov ).removeClass('hidden');
		}

	}
});
