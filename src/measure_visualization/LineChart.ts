import {IMeasureVisualization, ISetParameters} from '../';
import * as d3 from 'd3';

export class LineChart implements IMeasureVisualization{

  private formatData(setParameters: ISetParameters)
  {
    let numericSet;
    let categorySet;
    let categories;
    let xLabel;

    if(setParameters.setADesc.type === 'number'){
      numericSet = setParameters.setA;
      xLabel = setParameters.setADesc.label;
      categorySet = setParameters.setB;
      categories = setParameters.setBDesc.categories;
    }else {
      numericSet = setParameters.setB;
      xLabel = setParameters.setBDesc.label;
      categorySet = setParameters.setA;
      categories = setParameters.setADesc.categories;
    }

    // combine both sets
    let combinedSet = [];
    for(let i=0; i<numericSet.length; i++)
    {
      combinedSet.push({
        category: categorySet[i],
        value: numericSet[i]
      });
    }
    let amountItems = combinedSet.length;

    //define category sets
    for(let c=0; c<categories.length; c++)
    {
      const currCategory = categories[c].name;
      let numCategory = combinedSet.filter((item) => { return item.category === currCategory; }).length;
      categories[c]['amount'] = numCategory;
    }

    // sort the combined set
    combinedSet.sort((a,b) => { return b.value - a.value;});
    // console.log('combineSet: ', combinedSet);

    let dataLines = [];
    //
    for(let i=0; i<combinedSet.length; i++)
    {
      for(let c=0; c<categories.length; c++)
      {
        const currCategory = categories[c].name;
        const amountCategory = categories[c].amount;
        const termPlus = Math.sqrt((amountItems-amountCategory)/amountCategory);
        const termMinus = Math.sqrt(amountCategory/(amountItems-amountCategory));

        if(i==0){
          let temp = {category: currCategory,
                      color: categories[c].color,
                      values: []};
          let currValue;
          if(combinedSet[i].category === currCategory){
            currValue = termPlus;
          }else {
            currValue = 0 - termMinus;
          }
          temp.values.push({y: currValue,
                            x: combinedSet[i].value});
          dataLines.push(temp);
          
        }else{
          const lastValue = dataLines[c].values[dataLines[c].values.length-1].y;
          let currValue;
          if(combinedSet[i].category === currCategory){
            currValue = lastValue + termPlus;
          }else {
            currValue = lastValue - termMinus;
          }

          dataLines[c].values.push({y: currValue,
                                    x: combinedSet[i].value});
        }
      }
    }
    
    console.log('dataLines: ', dataLines);

    let minMaxValues = []; //for domains

    for(let i=0; i<dataLines.length; i++)
    {
      const min = Math.min(...dataLines[i].values.map((item) => (item.y)));
      minMaxValues.push(min);

      const max = Math.max(...dataLines[i].values.map((item) => (item.y)));
      minMaxValues.push(max);

      const score = Math.abs(max) > Math.abs(min) ? max : min;
      dataLines[i]['enrichmentScore'] = score;
    }


    let domainSpace = 0.01; //add space to domain so that the data points are not on the axis
    let xDomain = [Math.min(...numericSet),Math.max(...numericSet)];
    let yDomain = [Math.min(...minMaxValues),Math.max(...minMaxValues)];

    if(yDomain[0] === yDomain[1])
    {
      yDomain[0] = yDomain[0] - 5;
      yDomain[1] = yDomain[1] + 5;
    }
 
    // add space to x-domain
    // xDomain[0] = xDomain[0]-Math.abs(xDomain[1]*(domainSpace/2));
    // xDomain[1] = xDomain[1]+Math.abs(xDomain[1]*(domainSpace/2));
    // add space to y-domain
    // yDomain[0] = yDomain[0]-Math.abs(yDomain[1]*domainSpace);
    // yDomain[1] = yDomain[1]+Math.abs(yDomain[1]*domainSpace);

    //switch min <--> max
    // let tmp = xDomain[0];
    // xDomain[0] = xDomain[1];
    // xDomain[1] = tmp;

    
    let lineChart = {
      xValues: combinedSet.map((a) => (a.value)),
      xLabel: xLabel,
      xDomain: xDomain,
      dataLines: dataLines,
      yLabel: 'Enrichment score',
      yDomain: yDomain
    }

    return lineChart;
  }

  public generateVisualization(miniVisualisation: d3.Selection<any>, setParameters: ISetParameters)
  {
    let formatData = this.formatData(setParameters);
    console.log('Line Chart - generateVisualization', setParameters);
    console.log('formatData: ', formatData);


    // remove old tooltip
    d3.select('body').selectAll('div.measure.tooltip').remove();

    // new tooltip
    let tooltipLineChart = d3.select('body').append('div')
                                              .style('display', 'none')
                                              .style('opacity', 0)
                                              .attr('class', 'tooltip measure');
    

    // get size of space and calculate scatter plot size
    let containerWidth = Number(miniVisualisation.style('width').slice(0,-2)) - 25; //-25 because of the scroll bar

    let maxHeight = 220;
    let margin = {top: 10, right: 20, bottom: 20, left: 100};
    let width = containerWidth - margin.left - margin.right;
    let height = maxHeight - margin.top - margin.bottom;

    // create baseline values
    let baseline = formatData.xDomain.map((item) => { return {x: Number(item),
                                                              y: 0};}) as any;
    console.log('baseline: ',baseline);
    // x: scales + axis + map function for the data points
    let xScale = d3.scale.linear().range([0, width]);
    let xAxis = d3.svg.axis().scale(xScale).orient('bottom');
    let xMap = function(d) { return xScale(d.x);};
    
    // y: scale + axis + map function for the data points
    let yScale = d3.scale.linear().range([height, 0]);
    let yAxis = d3.svg.axis().scale(yScale).orient('left');
    let yMap = function(d) { return yScale(d.y);};

    // line function
    let line = d3.svg.line()
                        .x(d => xMap(d))
                        .y(d => yMap(d))
                        .interpolate("monotone");

    // svg canvas
    let svgCanvas = miniVisualisation.append('svg')
          .attr('width',width + margin.left + margin.right)
          .attr('height',height + margin.top + margin.bottom);      

    let svgFigureGroup = svgCanvas.append('g')
                                  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
                                  .attr('class','linechart');

    // set scale.domain
    xScale.domain(formatData.xDomain);
    yScale.domain(formatData.yDomain);

    // add axis to the canvas
    // x-axis
    svgFigureGroup.append('g')
                  .attr('class', 'x axis')
                  .attr('transform', 'translate(0,' + height + ')')
                  .call(xAxis)
                  .append('text')
                    .attr('class', 'label')
                    .attr('x', width)
                    .attr('y', -6)
                    .style('text-anchor', 'end')
                    .text(formatData.xLabel);

    // y-axis
    svgFigureGroup.append('g')
                  .attr('class', 'y axis')
                  .call(yAxis)
                  .append('text')
                    .attr('class', 'label')
                    .attr('transform', 'rotate(-90)')
                    .attr('y', 6)
                    .attr('dy', '.71em')
                    .style('text-anchor', 'end')
                    .text(formatData.yLabel);

    // add baseline at 0
    svgFigureGroup.append("g")
                  .attr('class', 'baseline')
                  .append('path')
                      .attr('d',line(baseline))
                      .style('stroke','black');
    
    // data lines
    svgFigureGroup.append("g")
                  .attr('class', 'all-datalines')
                  .selectAll("path")
                    .data(formatData.dataLines)
                    .enter().append('path')
                      .attr('class','dataline')
                      .attr('d',d => line(d.values))
                      .style('stroke',(d) => d !== null  ? d.color : null)
                      .on('mouseover', function(d) {
                        let m = d3.mouse(d3.select('body').node());
                        tooltipLineChart.transition()
                                          .duration(500)
                                          .style('display','block')
                                          .style('opacity', .9);
                        tooltipLineChart.html(`Category: ${d.category}</br>Enrichment Score: ${d.enrichmentScore.toFixed(3)}`)
                                          .style('left', (m[0] + 5) + 'px')
                                          .style('top', (m[1]- 28) + 'px');
                      })
                      .on('mouseout', function(d) {
                        tooltipLineChart.transition()
                                          .duration(500)
                                          .style('display','none')
                                          .style('opacity', 0);
                      });

  }



}