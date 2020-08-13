import { GroupedBarChart } from './GroupedBarChart';
import * as d3 from 'd3';
export class RelGroupedBarChart extends GroupedBarChart {
    formatData(setParameters, score) {
        const data = super.formatData(setParameters, score);
        let maxRelFreq = 0;
        for (const bargroup of data.bargroups) {
            bargroup.amountSetA = 1.0 * bargroup.amountSetA / setParameters.setA.length; // normalize
            bargroup.amountSetB = 1.0 * bargroup.amountSetB / setParameters.setB.length;
            maxRelFreq = Math.max(bargroup.amountSetA, bargroup.amountSetB, maxRelFreq);
        }
        data.yDomain = [0, maxRelFreq];
        return data;
    }
    getYAxis(yScale) {
        return super.getYAxis(yScale).tickFormat(d3.format('.0%')); // show y-axis labels as %
    }
}
//# sourceMappingURL=RelGroupedBarChart.js.map