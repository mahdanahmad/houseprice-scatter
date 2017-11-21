$( document ).ready(function() {
	d3.select('#barchart-container').selectAll('svg').remove();

	let canvasWidth		= $('#scatter-container').outerWidth(true);
	let canvasHeight	= $('#scatter-container').height();

	let margin 			= { top: 25, right: 150, bottom: 25, left: 50 };
	let width			= canvasWidth - margin.right - margin.left;
	let height			= canvasHeight - margin.top - margin.bottom;

	let x 				= d3.scaleTime().range([0, width]);
	let y 				= d3.scaleLinear().range([height, 0]);
	let colorScale		= d3.scaleLinear().range(["lightblue", "orange", "red"]);

	let tabs			= ['A', 'B', 'C', 'D'];
	let tab				= _.head(tabs);

	let parseTime		= d3.timeParse("%m-%Y");
	let voronoi			= d3.voronoi().x((o) => (o.x)).y((o) => (y(o.val))).extent([[-1, -1], [width + 1, height + 1]]);
	let line			= d3.line().x((o) => (o.x)).y((o) => (o.y));

	let svg = d3.select("#scatter-container").append("svg")
		.attr('width', width + margin.left + margin.right)
		.attr('height', height + margin.top + margin.bottom)
		.append('g')
		  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

	d3.csv("public/data.csv", (err, raw) => {
		if (err) throw err;

		let grouped	= _.chain(raw).groupBy('house_cat').mapValues((o) => (_.map(o, (d) => ({
			prov	: _.kebabCase(d.province_code),
			val		: _.round(parseFloat(d.median)),
			date	: parseTime(d.month + '-' + d.year)
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

		svg.append("path")
			.attr("id", "crosser")
			.attr("d", "");

		svg.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + height + ")")
			.call(d3.axisBottom(x).tickFormat(d3.timeFormat("%b-%Y")));

		svg.append("g")
			.attr("class", "y axis")
			.call(d3.axisLeft(y).ticks(8, "s").tickSize(-width));

		let provHeight	= (height / (provs.length));
		svg.append("g").attr("transform", "translate(" + (margin.left + width) + ",0)").selectAll("prov").data(provs)
			.enter().append("text")
				.attr("id", (o) => ("txt-" + o.base))
				.attr("class", "prov cursor-pointer")
				.attr("x", "0")
				.attr("y", (o, i) => ( i * provHeight ))
				.text((o) => (o.shown));

		svg.append('circle')
			.attr("id", "onhover")
			.attr("class", "hidden")
			.attr("r", 7);


		let groupCircle	= svg.append("g").attr('id', 'dot-crowd').selectAll(".group-circle").data(data).enter().append("g")

		groupCircle.append("circle")
			.attr("class", (o) => (o.prov + " dot"))
			.attr("r", 3)
			.attr("fill", (o) => (colorScale(o.val)))
			.attr("cx", (d) => (d.x))
			.attr("cy", (d) => (y(d.val)));

		groupCircle.append("path")
			.attr("class", "polygons")
			.attr("d", (o) => (o.poly ? "M" + o.poly.join("L") + "Z" : null));

		groupCircle.on('mouseover', (o) => {
			d3.select('#onhover')
				.attr('cx', o.x)
				.attr('cy', y(o.val))

			d3.select('#onhover').classed('hidden', false);

			console.log($( '#txt-' + o.prov ).outerWidth(true));

			let addtn	= _.times(2, (i) => ({ x: -10 + margin.left + width + (i == 0 ? 0 : margin.right), y: parseFloat($( '#txt-' + o.prov ).attr('y')) + 5 }));
			let path	= _.chain($( '.dot.' + o.prov ).map(function(d) { return ({ x: parseFloat($(this).attr('cx')), y: parseFloat($(this).attr('cy')) }) })).sortBy('x').concat(addtn).value();
			d3.select("path#crosser").transition().attr("d", line(path));
		});

		svg.on('mouseleave', () => { d3.select('#onhover').classed('hidden', true); d3.select("path#crosser").transition().attr("d", ""); })
	});
});
