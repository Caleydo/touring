import {IAttributeDesc, Comparison, SCOPE, ISimilarityMeasure, IMeasureOptions, Type} from './interfaces';
import {defaultMeasureOptions} from './config';
import {intersection, binom2, sleep} from './util'
import * as d3 from 'd3';
import {jStat} from 'jStat';


export const registeredClasses = new Array<ASimilarityMeasure>();
export function MeasureDecorator() {
  return function (target: {new(): ASimilarityMeasure}) { //only instantiable subtypes of ASimilarityClass can be passed.
    registeredClasses.push(new target()); //TODO apply options
  };
}


export abstract class ASimilarityMeasure implements ISimilarityMeasure {
  
  public id: string;
  public label: string;
  public description: string;
  
  public type: Comparison;
  public scope: SCOPE;
  
  protected readonly options: IMeasureOptions;
  
  constructor(options = defaultMeasureOptions()) {
    this.options = options;
  }  

  public abstract calc(setA: Array<any>, setB: Array<any>);
}

/**
 * Also known as the Tanimoto distance metric. 
 */
@MeasureDecorator()
export class JaccardSimilarity extends ASimilarityMeasure {

  constructor(options?: IMeasureOptions) {
    super(options);

    // TODO improve the measure description somehow:
    this.id = "jaccard"
    this.label = "Jaccard Index"
    this.description = "The size of the intersection divided by the size of the union of the sample sets."

    this.type = Comparison.get(Type.CATEGORICAL, Type.CATEGORICAL);
    this.scope = SCOPE.SETS;
  }


  public calc(setA: Array<any>, setB: Array<any>) {
    const {intersection: intersect, arr1: filteredsetA, arr2: filteredsetB} = intersection(setA, setB);
    const score = intersect.length / (intersect.length + filteredsetA.length + filteredsetB.length);
    
    return score || 0;
  }
}


@MeasureDecorator()
export class OverlapSimilarity extends ASimilarityMeasure {

  constructor(options?: IMeasureOptions) {
    super(options);

    // TODO improve the measure description somehow:
    this.id = "overlap"
    this.label = "Overlap coefficient" //Szymkiewicz-Simpson
    this.description = "The size of the intersection divided by the size of the smaller set."

    this.type = Comparison.get(Type.CATEGORICAL, Type.CATEGORICAL);
    this.scope = SCOPE.SETS;
  }


  calc(setA: Array<any>, setB: Array<any>) {
    const {intersection: intersect} = intersection(setA, setB);
    const score = intersect.length /  Math.min(setA.length, setB.length);

    return score || 0;
  }
}


@MeasureDecorator()
export class StudentTTest extends ASimilarityMeasure {

  constructor(options?: IMeasureOptions) {
    super(options);

    // TODO improve the measure description somehow:
    this.id = 'student_test';
    this.label = "Student's t-Test";
    this.description = "Compares the means of two samples (assuimg equal variances in their respective normal distributions).";

    this.type = Comparison.get(Type.CATEGORICAL, Type.NUMERICAL);
    this.scope = SCOPE.SETS;
  }


  calc(setA: Array<any>, setB: Array<any>) {
    const setAValid = setA.filter((value) => {return (value !== null && value !== undefined);});
    const nSelection = setAValid.length;
    const muSelection = d3.mean(setAValid);
    const varSelection = d3.variance(setAValid);

    //category
    const setBValid = setB.filter((value) => {return (value !== null && value !== undefined);});
    const nCategory = setBValid.length;
    const muCategory = d3.mean(setBValid);
    const varCategory = d3.variance(setBValid);

    let scoreP1 = Math.sqrt((nSelection * nCategory * (nSelection + nCategory - 2)) / (nSelection + nCategory));
    let scoreP2 = (muSelection - muCategory) / Math.sqrt((nSelection - 1) * varSelection + (nCategory - 1) * varCategory);
    let score = scoreP1 * scoreP2;

    let intersect = intersection(setAValid,setBValid);
    if((intersect.intersection.length === setAValid.length) && (setAValid.length === setBValid.length))
    {
      score = 0.000001;
    }

    // console.log('T-Test: ',score, '| df: ',nCategory + nSelection-2);

    return score ? jStat.jStat.ttest(score, nCategory + nSelection, 2) : 0;
  }
}


@MeasureDecorator()
export class WelchTTest extends ASimilarityMeasure {

  constructor(options?: IMeasureOptions) {
    super(options);

    // TODO improve the measure description somehow:
    this.id = 'welch_test';
    this.label = "Welch's t-test";
    this.description = "Compares the means of two samples (normal distributed).";

    this.type = Comparison.get(Type.NUMERICAL, Type.NUMERICAL);
    this.scope = SCOPE.SETS;
  }


  calc(setA: Array<any>, setB: Array<any>) {
    return 1 - Math.random(); // ]0,1]
  }
}

@MeasureDecorator()
export class WilcoxonRankSumTest extends ASimilarityMeasure {

  constructor(options?: IMeasureOptions) {
    super(options);

    // TODO improve the measure description somehow:
    this.id = 'wilcoxon-rank-sum_test';
    this.label = "Wilcoxon Rank-Sum Test";
    this.description = "Compares two samples of homogenity (non-parametric test).";

    this.type = Comparison.get(Type.CATEGORICAL, Type.NUMERICAL);
    this.scope = SCOPE.SETS;
  }


  calc(setA: Array<any>, setB: Array<any>) {
    let setAValid = setA.filter((value) => {return (value !== null && value !== undefined);});
    let selectionRankObj = setAValid.map((a) => { 
        let returnObj = {
          set: 'selection',
          value: a
        };
        return returnObj; 
      });

    let setBValid = setB.filter((value) => {return (value !== null && value !== undefined);});
    let categoryRankObj = setBValid.map((b) => { 
        let returnObj = {
          set: 'category',
          value: b
        };
        return returnObj; 
      });

    //create array with all values and their affiliation
    let collectiveRankSet = selectionRankObj.concat(categoryRankObj);
    //sort the set from low to high
    collectiveRankSet.sort((a,b) => { return a.value - b.value;});

    // assing rank 
    // array for the idecies of the redion with the same values
    let regionRange = [];
    // flag to indicate a two or more values are equal
    let region = false;
    for(let i=0;i< collectiveRankSet.length; i++)
    {
      // check if previous and current values are equal  
      if(i>=1 && collectiveRankSet[i-1].value === collectiveRankSet[i].value)
      {
        // if previous === current
        // set region flag = ture and save indicies in regionRange array
        region = true;
        regionRange.push(i-1); 
        regionRange.push(i); 
      }

      // check if a region exists (flag = true) and the previous != current values
      if(region && collectiveRankSet[i-1].value !== collectiveRankSet[i].value && regionRange.length > 1)
      {
        // region = true and previous != current -> region over
        // remove duplicate idex values
        let uniqueRegionRange = regionRange.filter((v,i) => {return regionRange.indexOf(v) === i;});
        // calculate rank for the region
        let regionRank = (uniqueRegionRange.reduce((a, b) => a + b, 0) + uniqueRegionRange.length) / uniqueRegionRange.length;

        //cahnge the ranks in the privous items
        for(let r=0;r<uniqueRegionRange.length; r++)
        {
          collectiveRankSet[uniqueRegionRange[r]]['rank'] = regionRank;
        }
        regionRange = [];
        region = false;
      }

      // set rank = index + 1
      collectiveRankSet[i]['rank'] = i+1;
      
    }

    // check if the last values where in a region
    if(region && regionRange.length > 1)
    {
      // region = true and previous != current -> region over
      // remove duplicate idex values
      let uniqueRegionRange = regionRange.filter((v,i) => {return regionRange.indexOf(v) === i;});
      // calculate rank for the region
      let regionRank = (uniqueRegionRange.reduce((a, b) => a + b, 0) + uniqueRegionRange.length) / uniqueRegionRange.length;

      //cahnge the ranks in the privous items
      for(let r=0;r<uniqueRegionRange.length; r++)
      {
        collectiveRankSet[uniqueRegionRange[r]]['rank'] = regionRank;
      }
      regionRange = [];
      region = false;
    }
    
    // console.log('collectiveRankSet: ',collectiveRankSet);

    // split the rankSet into the two categories and get only the rank property
    let selectionRanks = collectiveRankSet
      .filter((item) => (item.set === 'selection'))
      .map((a) => {return (a as any).rank;});

    let categoryRanks = collectiveRankSet
      .filter((item) => (item.set === 'category'))
      .map((a) => {return (a as any).rank;});

    // calculate rank sum for each category
    let nSelection = selectionRanks.length;
    let selectionRankSum = selectionRanks.reduce((a, b) => a + b, 0);
    
    let nCategroy = categoryRanks.length;
    let categoryRankSum = categoryRanks.reduce((a, b) => a + b, 0);    


    
    // calculate the test statistic U
    let selectionU = nSelection * nCategroy + ( nSelection*(nSelection+1)/2) - selectionRankSum;
    let categoryU = nSelection * nCategroy + ( nCategroy*(nCategroy+1)/2) - categoryRankSum;

    let minU = Math.min(selectionU,categoryU);
    
    // calculate z-value -> for big sample sizes each more than 10 use normal distribution (z-value)
    let zValue = (minU - (nSelection * nCategroy)/2) / Math.sqrt((nSelection * nCategroy * (nSelection + nCategroy +1))/12);
    // console.log('minU: ',minU);
    // console.log('zValue: ',zValue);
    // console.log('Us + Uc: ',selectionU+categoryU,'| n1*n2: ',nSelection*nCategroy);

    if(zValue === 0)
    {
      zValue = 0.000001;
    }

    let score = zValue;

    return score ? jStat.jStat.ztest(score, 2) : 0;
  }
}


/**
 * MannWhitneyUTest === WilcoxonRankSumTest, therefore this class is just a rename
 */
@MeasureDecorator()
export class MannWhitneyUTest extends WilcoxonRankSumTest {

  constructor(options?: IMeasureOptions) {
    super(options);

    this.id = 'mwu_test';
    this.label = "Mann-Whitney U Test";
  }
}


/**
 * Also known as the Tanimoto distance metric. 
 */
@MeasureDecorator()
export class AdjustedRandIndex extends ASimilarityMeasure {

  constructor(options?: IMeasureOptions) {
    super(options);

    // TODO improve the measure description somehow:
    this.id = "adjrand"
    this.label = "Adjusted Rand Index"
    this.description = "blablabla"

    this.type = Comparison.get(Type.CATEGORICAL, Type.CATEGORICAL);
    this.scope = SCOPE.ATTRIBUTES;
  }


  public async calc(arr1: Array<any>, arr2: Array<any>): Promise<number> {
    
    if (arr1.length != arr2.length) {
      throw Error('Value Pairs are compared, therefore the array sizes have to be equal.');
    }
    
    // deduce catgeories from strings, e.g.: ['Cat1', 'Cat3', 'Cat2', 'Cat2', 'Cat1', 'Cat3']
    const A = [...new Set(arr1)]; // The set removes duplicates, and the conversion to array gives the content an order
    const B = [...new Set(arr2)];
    
    // and build a contingency table:
    //        A.1   A.2   A.3
    //  B.1   n11   n12   n13
    //  B.2   n21   n22   n23
    //  B.3   n31   n32   n33
    const table = new Array(B.length).fill([]); // rows
    table.forEach((row, i) => table[i] = new Array(A.length).fill(0)) // columns

    for (let i of arr1.keys()) { // iterate over indices
      const Ai = A.indexOf(arr1[i]);
      const Bi = B.indexOf(arr2[i]);
      table[Bi][Ai] += 1; // count the co-occurences 
    }

    // https://web.archive.org/web/20171205003116/https://davetang.org/muse/2017/09/21/adjusted-rand-index/
    const rowsSums = table.map((row) => row.reduce((sum, curr) => sum += curr)); // reduce each row to the sum
    const colSums = A.map((cat, i) => table.reduce((sum, curr) => sum += curr[i], 0)); // reduce each all rows to the sum of column i

    //const cellBinomSum = table.reduce((rowsum, row) => rowsum + row.reduce((colsum, col) => colsum += binom2(col), 0), 0);
    const cellBinomSum = table.reduce((sum, row) => sum + row.reduce((colsum, col) => colsum += binom2(col), 0), 0); // set accumulator to zero!

    //use 0 as initial value, otherwise reduce takes the first element as initial value and the binom coefficient is nt calculated for it!
    const rowBinomSum = rowsSums.reduce((sum, curr) => sum += binom2(curr), 0); 
    const colBinomSum = colSums.reduce((sum, curr) => sum += binom2(curr), 0);

    const index = cellBinomSum;
    const expectedIndex = (rowBinomSum * colBinomSum) / binom2(arr1.length);
    const maxIndex = 0.5 * (rowBinomSum + colBinomSum);

    // await sleep(5000); //test asynchronous behaviour
    // calc 

    if (0 === (maxIndex - expectedIndex)) {
      // division by zero --> adj_index = NaN
      return 1;
    }
    const adj_index = (index - expectedIndex) / (maxIndex - expectedIndex);
    return adj_index; // async function --> returns promise
  }
}