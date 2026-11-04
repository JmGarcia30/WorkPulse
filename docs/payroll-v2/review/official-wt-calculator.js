/* 
 * 
 * 2018 Copyright © Bureau of Internal Revenue Withholding Tax Calculator All rights reserved. 
 * BIR Withholding Tax Calculator is under the supervision of the Information Systems Group of the 
 * Bureau of Internal Revenue.
 *
 */












































































// The keys represent the type of payroll period
var period = new Array();
	period["daily"]=264;
	period["weekly"]=66;
	period["semi_monthly"]=24;
	period["monthly"]=12;
	period["annual"]=1;


// Start of Functions to get inputted values from the form.

function getPayrollPeriod()
{
	var pr_period=0;
	var pr_period_form = document.forms["withholding_tax_calculator"];
	var selected_pr_period = pr_period_form.elements["payroll_period"];
	
	pr_period=parseFloat(period[selected_pr_period.value]);
	
	return pr_period;
}


function getBasicSalary()
{
	var basic_salary=0;
	var basic_salary_form = document.forms["withholding_tax_calculator"];
	var basic_salary_input = basic_salary_form.elements["basicSalary"];
	 
	if(basic_salary_input.value!="")
	{
		basic_salary = parseFloat(basic_salary_input.value.replace(/,/g, ''));
	} else
		{
			basic_salary = 0;
		}
	return basic_salary;
}

function getRepresentationAllowance()
{
	var representation_allowance=0;
	var representation_allowance_form = document.forms["withholding_tax_calculator"];
 	var representation_allowance_input = representation_allowance_form.elements["representationAllowance"];
 
 	if(representation_allowance_input.value!="")
 	{
  		representation_allowance = parseFloat(representation_allowance_input.value.replace(/,/g, ''));
 	} else
		{
			representation_allowance = 0;
		}
	return representation_allowance;
}

function getTransportationAllowance()
{
	var transportation_allowance=0;
	var transportation_allowance_form = document.forms["withholding_tax_calculator"];
 	var transportation_allowance_input = transportation_allowance_form.elements["transportationAllowance"];
 
 	if(transportation_allowance_input.value!="")
 	{
  		transportation_allowance = parseFloat(transportation_allowance_input.value.replace(/,/g, ''));
 	} else
		{
			transportation_allowance = 0;
		}
	return transportation_allowance;
}

function getCostOfLivingAllowance()
{
	var cost_of_living_allowance=0;
	var cost_of_living_allowance_form = document.forms["withholding_tax_calculator"];
 	var cost_of_living_allowance_input = cost_of_living_allowance_form.elements["costOfLivingAllowance"];
 
 	if(cost_of_living_allowance_input.value!="")
 	{
  		cost_of_living_allowance = parseFloat(cost_of_living_allowance_input.value.replace(/,/g, ''));
 	}  else
		{
			cost_of_living_allowance = 0;
		}
	return cost_of_living_allowance;
}

function getFixedHousingAllowance()
{
	var housing_allowance=0;
	var housing_allowance_form = document.forms["withholding_tax_calculator"];
	var housing_allowance_input = housing_allowance_form.elements["fixedHousingAllowance"];
 
 	if(housing_allowance_input.value!="")
 	{
  		housing_allowance = parseFloat(housing_allowance_input.value.replace(/,/g, ''));
 	} else
		{
			housing_allowance = 0;
		}
	return housing_allowance;
}

function getOtherTaxableRegular()
{
	var other_regular_taxable=0;
	var other_regular_taxable_form = document.forms["withholding_tax_calculator"];
 	var other_regular_taxable_input = other_regular_taxable_form.elements["otherTaxableRegular"];
 
 	if(other_regular_taxable_input.value!="")
 	{
  		other_regular_taxable = parseFloat(other_regular_taxable_input.value.replace(/,/g, ''));
 	} else
		{
			other_regular_taxable = 0;
		}
	return other_regular_taxable;
}

// Supplementary
function getCommission()
{
	var commissions=0;
	var commissions_form = document.forms["withholding_tax_calculator"];
 	var commissions_input = commissions_form.elements["commission"];
 
 	if(commissions_input.value!="")
 	{
  	commissions = parseFloat(commissions_input.value.replace(/,/g, ''));
 	}  else
		{
			commissions = 0;
		}
	return commissions;
}

function getProfitSharing()
{
	var profit_sharing=0;
	var profit_sharing_form = document.forms["withholding_tax_calculator"];
 	var profit_sharing_input = profit_sharing_form.elements["profitSharing"];
 
 	if(profit_sharing_input.value!="")
 	{
  		profit_sharing = parseFloat(profit_sharing_input.value.replace(/,/g, ''));
 	}  else
		{
			profit_sharing = 0;
		}
	return profit_sharing;
}

function getFeesPlusDirector()
{
	var fees_plus_director=0;
	var fees_plus_director_form = document.forms["withholding_tax_calculator"];
 	var fees_plus_director_input = fees_plus_director_form.elements["fees"];
 
 	if(fees_plus_director_input.value!="")
 	{
  		fees_plus_director = parseFloat(fees_plus_director_input.value.replace(/,/g, ''));
 	}  else
		{
			fees_plus_director = 0;
		}
	return fees_plus_director;
}

function getOtherBenefits()
{
	var other_benefits=0;
	var other_benefits_form = document.forms["withholding_tax_calculator"];
 	var other_benefits_input = other_benefits_form.elements["otherBenefits"];
 
 	if(other_benefits_input.value!="")
 	{
  		other_benefits = parseFloat(other_benefits_input.value.replace(/,/g, ''));
 	}  else
		{
			other_benefits = 0;
		}
	return other_benefits;
}

function getHazardPay()
{
	var hazard_pay=0;
	var hazard_pay_form = document.forms["withholding_tax_calculator"];
 	var hazard_pay_input = hazard_pay_form.elements["hazardPay"];
 
 	if(hazard_pay_input.value!="")
 	{
  	hazard_pay = parseFloat(hazard_pay_input.value.replace(/,/g, ''));
 	}  else
		{
			hazard_pay = 0;
		}
	return hazard_pay;
}

function getOvertimePay()
{
	var overtime_pay=0;
	var overtime_pay_form = document.forms["withholding_tax_calculator"];
 	var overtime_pay_input = overtime_pay_form.elements["overtimePay"];
 
 	if(overtime_pay_input.value!="")
 	{
  		overtime_pay = parseFloat(overtime_pay_input.value.replace(/,/g, ''));
 	}  else
		{
			overtime_pay = 0;
		}
	return overtime_pay;
}

function getOtherTaxableSupplementary()
{
	var other_compensation=0;
	var other_compensation_form = document.forms["withholding_tax_calculator"];
 	var other_compensation_input = other_compensation_form.elements["otherTaxableSupplementary"];
 
 	if(other_compensation_input.value!="")
 	{
  		other_compensation = parseFloat(other_compensation_input.value.replace(/,/g, ''));
 	}  else
		{
			other_compensation = 0;
		}
	return other_compensation;
}

// Non-Taxable

function getBasicSalaryNt()
{
	var basic_salary_nt=0;
	var basic_salary_form_nt = document.forms["withholding_tax_calculator"];
 	var basic_salary_input_nt = basic_salary_form_nt.elements["basicSalaryNt"];
 
 	if(basic_salary_input_nt.value!="")
 	{
  		basic_salary_nt = parseFloat(basic_salary_input_nt.value.replace(/,/g, ''));
 	} else
		{
			basic_salary_nt = 0;
		}
	return basic_salary_nt;
}

function getHolidayPayNt()
{
	var holiday_pay_nt=0;
	var holiday_pay_form_nt = document.forms["withholding_tax_calculator"];
 	var holiday_pay_input_nt = holiday_pay_form_nt.elements["holidayPayNt"];
 
 	if(holiday_pay_input_nt.value!="")
 	{
  		holiday_pay_nt = parseFloat(holiday_pay_input_nt.value.replace(/,/g, ''));
 	}  else
		{
			holiday_pay_nt = 0;
		}
	return holiday_pay_nt;
}

function getOvertimePayNt()
{
	var overtime_pay_nt=0;
	var overtime_pay_form_nt = document.forms["withholding_tax_calculator"];
 	var overtime_pay_input_nt = overtime_pay_form_nt.elements["overtimePayNt"];
 
 	if(overtime_pay_input_nt.value!="")
 	{
  		overtime_pay_nt = parseFloat(overtime_pay_input_nt.value.replace(/,/g, ''));
 	} else
		{
			overtime_pay_nt = 0;
		}
	return overtime_pay_nt;
}

function getNightShiftDifferentialNt()
{
	var night_shift_differential_nt=0;
	var night_shift_differential_form_nt = document.forms["withholding_tax_calculator"];
 	var night_shift_differential_input_nt = night_shift_differential_form_nt.elements["nightShiftDifferentialNt"];
 
 	if(night_shift_differential_input_nt.value!="")
 	{
  		night_shift_differential_nt = parseFloat(night_shift_differential_input_nt.value.replace(/,/g, ''));
 	} else
		{
			night_shift_differential_nt = 0;
		}
	return night_shift_differential_nt;
}

function getHazardPayNt()
{
	var hazard_pay_nt=0;
	var hazard_pay_form_nt = document.forms["withholding_tax_calculator"];
 	var hazard_pay_input_nt = hazard_pay_form_nt.elements["hazardPayNt"];
 
 	if(hazard_pay_input_nt.value!="")
 	{
  		hazard_pay_nt = parseFloat(hazard_pay_input_nt.value.replace(/,/g, ''));
 	} else
		{
			hazard_pay_nt = 0;
		}
	return hazard_pay_nt;
}

function getOtherBenefitsNt()
{
	var other_benefits_nt=0;
	var other_benefits_form_nt = document.forms["withholding_tax_calculator"];
 	var other_benefits_input_nt = other_benefits_form_nt.elements["otherBenefitsNt"];
 
 	if(other_benefits_input_nt.value!="")
 	{
  	other_benefits_nt = parseFloat(other_benefits_input_nt.value.replace(/,/g, ''));
 	}  else
		{
			other_benefits_nt = 0;
		}
	return other_benefits_nt;
}

function getDeMinimisBenefitsNt()
{
	var de_minimis_benefits_nt=0;
	var de_minimis_benefits_form_nt = document.forms["withholding_tax_calculator"];
 	var de_minimis_benefits_input_nt = de_minimis_benefits_form_nt.elements["deMinimisBenefitsNt"];
 
 	if(de_minimis_benefits_input_nt.value!="")
 	{
  		de_minimis_benefits_nt = parseFloat(de_minimis_benefits_input_nt.value.replace(/,/g, ''));
 	} else
		{
			de_minimis_benefits_nt = 0;
		}
	return de_minimis_benefits_nt;
}

function getSssGsisPagibigNt()
{
	var sgp_nt=0;
	var sgp_nt_form = document.forms["withholding_tax_calculator"];
 	var sgp_nt_input = sgp_nt_form.elements["sssGsisPagibigNt"];
 
 	if(sgp_nt_input.value!="")
 	{
  		sgp_nt = parseFloat(sgp_nt_input.value.replace(/,/g, ''));
 	} else
		{
			sgp_nt = 0;
		}
	return sgp_nt;
}

function getSalariesOtherComepnsationNt()
{
	var salaries_nt=0;
	var salaries_nt_form = document.forms["withholding_tax_calculator"];
 	var salaries_nt_input = salaries_nt_form.elements["salariesOtherComepnsationNt"];
 
 	if(salaries_nt_input.value!="")
 	{
  		salaries_nt = parseFloat(salaries_nt_input.value.replace(/,/g, ''));
 	} else
		{
			salaries_nt = 0;
		}
	return salaries_nt;
}

function getOtherCompensationNt1()
{
	var other_compensation_nt1=0;
	var other_compensation_form_nt1 = document.forms["withholding_tax_calculator"];
 	var other_compensation_input_nt1 = other_compensation_form_nt1.elements["otherCompensationNt1"];
 
 	if(other_compensation_input_nt1.value!="")
 	{
  		other_compensation_nt1 = parseFloat(other_compensation_input_nt1.value.replace(/,/g, ''));
 	} else
		{
			other_compensation_nta = 0;
		}
	return other_compensation_nt1;
}

function getPremiumPaidInsurance()
{
	var paid_insurance=0;
	var paid_insurance_form = document.forms["withholding_tax_calculator"];
	var paid_insurance_input = paid_insurance_form.elements["paidInsurance"];
	
	if(paid_insurance_input.value!="")
	{
		paid_insurance = parseFloat(paid_insurance_input.value.replace(/,/g, ''));
	} else
		{
			paid_insurance = 0;
		}
	return paid_insurance;
}


// Start of Functions that calculates

// this function gets the total of the second fieldset

function getPersonalAdditionalExemptions()
{
	var personal_exemptions=parseFloat(getPersonalExemption() + getNumberOfDependent());
	
	return personal_exemptions;
}

function getTotalRegular()
{
	//Here we get the total compensation income by calling our function
	//Each function returns a number so by calling them we add the values they return together
	var total_regular = getBasicSalary() + getRepresentationAllowance() + getTransportationAllowance() + getCostOfLivingAllowance() + getFixedHousingAllowance() + getOtherTaxableRegular();
	 
	//display the result
	//document.getElementById('grossCompensationIncome').value = parseFloat(Math.round(totalCompensationIncome * 100) / 100).toFixed(2);
	
	//return the result to be called by other functions
	return total_regular;

}

function getTaxableBenefits()
{
	var otherBenefitsNt = getOtherBenefitsNt();
	//var otherBenefits = getOtherBenefits();
	var totalBenefits = 0;
	
	if(otherBenefitsNt > 90000)
	{
		//totalBenefits = ((otherBenefitsNt - 90000) + otherBenefits);
		totalBenefits = otherBenefitsNt - 90000;
		document.getElementById('otherBenefits').value = addCommas(parseFloat(Math.round(totalBenefits * 100) / 100).toFixed(2));
		return totalBenefits;
	} else
	{
		document.getElementById('otherBenefits').value = addCommas(parseFloat(Math.round(totalBenefits * 100) / 100).toFixed(2));
		return totalBenefits;
	}
}

function getTotalSupplementary()
{
	//Here we get the total compensation income by calling our function
	//Each function returns a number so by calling them we add the values they return together
	var total_supplementary = getCommission() + getProfitSharing() + getFeesPlusDirector() + getTaxableBenefits() + getHazardPay() + getOvertimePay() + getOtherTaxableSupplementary();
	 
	//display the result
	//document.getElementById('grossCompensationIncome').value = parseFloat(Math.round(totalCompensationIncome * 100) / 100).toFixed(2);
	
	//return the result to be called by other functions
	return total_supplementary;

}

function getTNTOtherBenefits()
{
	var otherBenefitsNt2 = getOtherBenefitsNt();
	var totalBenefitsNt = 0;
	
	if(otherBenefitsNt2 > 90000)
	{
		totalBenefitsNt = 90000;
		return totalBenefitsNt;
	} else
	{
		totalBenefitsNt = otherBenefitsNt2;
		return totalBenefitsNt;
	}
}


// this function gets the total of the third fieldset
function getTotalNonTaxableNt()
{
	//Here we get the total non-taxable value by calling our function
	//Each function returns a number so by calling them we add the values they return together
	//var totalNonTaxable = getBasicSalaryNt() + getHolidayPayNt() + getOvertimePayNt() + getNightShiftDifferentialNt() + getHazardPayNt() + getTNTOtherBenefits() + getDeMinimisBenefitsNt() + getSssGsisPagibigNt() + getSalariesOtherComepnsationNt() + getOtherCompensationNt1(); -- original computation with sss
	var totalNonTaxable = getBasicSalaryNt() + getHolidayPayNt() + getOvertimePayNt() + getNightShiftDifferentialNt() + getHazardPayNt() + getTNTOtherBenefits() + getDeMinimisBenefitsNt() + getSssGsisPagibigNt() + getSalariesOtherComepnsationNt() + getOtherCompensationNt1();
 
	//return the result to be called by other functions
 	return totalNonTaxable;
}

function getTotalCompensationIncome()
{
	//Here we get the total compensation income by calling our function
	//Each function returns a number so by calling them we add the values they return together
	var totalCompensationIncome = getTotalRegular() + getTotalSupplementary();
	 
	//display the result
	//document.getElementById('grossCompensationIncome').value = parseFloat(Math.round(totalCompensationIncome * 100) / 100).toFixed(2);
	
	//return the result to be called by other functions
	return totalCompensationIncome;

}

// this function computes the Gross Compensation Income
function getGrossCompensationIncome()
{
	//Here we get the gross compensation income by calling our function
	//Each function returns a number so by calling them we add the values they return together
	//var taxablePlusNonTaxable = parseFloat(getTotalCompensationIncome() + getTotalNonTaxableNt() - getSssGsisPagibigNt());
	var totalCompensationIncome = getTotalCompensationIncome();
	var totalNonTaxableNt = getTotalNonTaxableNt();
	var sssGsisPagibigNt = getSssGsisPagibigNt();
	var taxablePlusNonTaxable = 0;
	
	if (getPayrollPeriod() < 4)
	{
		//taxablePlusNonTaxable = totalCompensationIncome + totalNonTaxableNt - sssGsisPagibigNt;
		taxablePlusNonTaxable = totalCompensationIncome + totalNonTaxableNt;
	} else
	{
		//taxablePlusNonTaxable = totalCompensationIncome + totalNonTaxableNt;
		//taxablePlusNonTaxable = totalCompensationIncome + totalNonTaxableNt - sssGsisPagibigNt;
		taxablePlusNonTaxable = totalCompensationIncome + totalNonTaxableNt;
	}
	
	//return the result to be called by other functions
	return taxablePlusNonTaxable;
}



// this function computes the Taxable Compensation Income
function getTaxableCompensationIncome()
{
	//Here we get the taxable compensation income by calling our function
	//Each function returns a number so by calling them we add the values they return together
	var totalCompensationIncome = getTotalCompensationIncome();
	var sssGsisPagibigNt = getSssGsisPagibigNt();
	var taxableMinusNonTaxable = 0;
	
	if (getPayrollPeriod() < 4)
	{
		taxableMinusNonTaxable = totalCompensationIncome;
	} else
	{
		//taxablePlusNonTaxable = totalCompensationIncome + totalNonTaxableNt;
		taxableMinusNonTaxable = totalCompensationIncome - sssGsisPagibigNt;
	}
	
	
	//return the result to be called by other functions
	return taxableMinusNonTaxable;
}

function getTotalExemptions()
{
	//Here we get the taxable compensation income by calling our function
	//Each function returns a number so by calling them we add the values they return together
	var gci = parseFloat(getGrossCompensationIncome());
	var premium_insurance = parseFloat(getPremiumPaidInsurance());
	//var additional_exemptions = parseFloat(getPersonalAdditionalExemptions());
	var total_exemptions = 0;
	
	
	if (getPayrollPeriod() < 4 && gci > 250000)
	{
		document.withholding_tax_calculator.paidInsurance.disabled=true;
		total_exemptions = 0;
		
		return total_exemptions;
		
	} else
		{
			document.withholding_tax_calculator.paidInsurance.disabled=false;
			if (premium_insurance > 2400)
			{
				total_exemptions = 2400;
				
				return 2400;
			} else
				{
					total_exemptions = premium_insurance;
					
					return total_exemptions;
				}
			
			//total_exemptions = parseFloat(getPersonalAdditionalExemptions());
			return total_exemptions;
		} 
	

	
	//return the result to be called by other functions
	
}


function getNetTaxableCompensationIncome()
{
	//Here we get the taxable compensation income by calling our function
	//Each function returns a number so by calling them we add the values they return together
	//var gross_taxable = parseFloat(getTotalCompensationIncome() - getSssGsisPagibigNt());
	var gross_taxable_dwsm = parseFloat(getTaxableCompensationIncome() + getSssGsisPagibigNt());
	var gross_taxable_annual = parseFloat(getTaxableCompensationIncome());
	//var sssGsisPagibigNt = parseFloat(getSssGsisPagibigNt());
	//var additional_exemptions = parseFloat(getTotalExemptions());
	var net_income = 0;
	
	if (document.getElementById("payroll_period").value == "annual")
	{
		net_income = gross_taxable_annual;
	} else
		{
			//document.withholding_tax_calculator.paidInsurance.disabled=true;
			net_income = gross_taxable_dwsm;
		}
	
	if (net_income < 0)
	{
		net_income = 0;
	}
	//return the result to be called by other functions
	return net_income;
}
// Start of Functions computing the Withholding tax based on Period

// The following functions computes the daily computations
function getDailyZero()
{
	var wtTaxableCompensationIncome = parseFloat(getTotalRegular());
	var wtSupplementary = parseFloat(getTotalSupplementary());
	var wtTotalTaxWithheld=0;
	
	if (wtTaxableCompensationIncome >= 21918)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 21918) + wtSupplementary) * 0.35) + 6034.30;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 5479) 
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 5479) + wtSupplementary) * 0.30) + 1102.60;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 2192)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 2192) + wtSupplementary) * 0.25) + 280.85;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 1096)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 1096) + wtSupplementary) * 0.20) + 61.65;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 685)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 685) + wtSupplementary) * 0.15);
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 0)
		{
			wtTotalTaxWithheld=((wtTaxableCompensationIncome - 0) + wtSupplementary);
			return wtTotalTaxWithheld;
		}
}



// The following functions computes the weekly computations
function getWeeklyZero()
{
	var wtTaxableCompensationIncome = parseFloat(getTotalRegular());
	var wtSupplementary = parseFloat(getTotalSupplementary());
	var wtTotalTaxWithheld=0;
	
	if (wtTaxableCompensationIncome >= 153846)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 153846) + wtSupplementary) * 0.35) + 42355.65;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 38462) 
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 38462) + wtSupplementary) * 0.30) + 7740.45;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 15385)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 15385) + wtSupplementary) * 0.25) + 1971.20;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 7692)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 7692) + wtSupplementary) * 0.20) + 432.60;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 4808)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 4808) + wtSupplementary) * 0.15);
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 0)
		{
			wtTotalTaxWithheld=0;
			return wtTotalTaxWithheld;
		}
}



// The following functions computes the semi-monthly computation
function getSemiMonthlyZero()
{
	var wtTaxableCompensationIncome = parseFloat(getTotalRegular());
	var wtSupplementary = parseFloat(getTotalSupplementary());
	var wtTotalTaxWithheld=0;
	
	if (wtTaxableCompensationIncome >= 333333)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 333333) + wtSupplementary) * 0.35) + 91770.70;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 83333) 
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 83333) + wtSupplementary) * 0.30) + 16770.70;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 33333)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 33333) + wtSupplementary) * 0.25) + 4270.70;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 16667)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 16667) + wtSupplementary) * 0.20) + 937.50;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 10417)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 10417) + wtSupplementary) * 0.15);
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 0)
		{
			wtTotalTaxWithheld=0;
			return wtTotalTaxWithheld;
		}
}



// The following functions computes the monthly computation
function getMonthlyZero()
{
	var wtTaxableCompensationIncome = parseFloat(getTotalRegular());
	var wtSupplementary = parseFloat(getTotalSupplementary());
	var wtTotalTaxWithheld=0;
	
	if (wtTaxableCompensationIncome >= 666667)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 666667) + wtSupplementary) * 0.35) + 183541.80;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 166667) 
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 166667) + wtSupplementary) * 0.30) + 33541.80;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 66667)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 66667) + wtSupplementary) * 0.25) + 8541.80;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 33333)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 33333) + wtSupplementary) * 0.20) + 1875;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 20833)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 20833) + wtSupplementary) * 0.15);
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 0)
		{
			wtTotalTaxWithheld=0;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome < 0)
		{
			wtTotalTaxWithheld=0;
			return wtTotalTaxWithheld;
		}
}



// The following functions computes the Annual computation
function getAnnual()
{
	var wtTaxableCompensationIncome = parseFloat(getTotalRegular());
	var wtSupplementary = parseFloat(getTotalSupplementary());
	var wtTotalTaxWithheld=0;
	
	if (wtTaxableCompensationIncome >= 8000000)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 8000000) + wtSupplementary) * 0.35) + 2202500;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 2000000) 
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 2000000) + wtSupplementary) * 0.30) + 402500;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 800000)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 800000) + wtSupplementary) * 0.25) + 102500;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 400000)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 400000) + wtSupplementary) * 0.20) + 22500;
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 250000)
		{
			wtTotalTaxWithheld=(((wtTaxableCompensationIncome - 250000) + wtSupplementary) * 0.15);
			return wtTotalTaxWithheld;
		}
		else if (wtTaxableCompensationIncome >= 0)
		{
			wtTotalTaxWithheld=0;
			return wtTotalTaxWithheld;
		} else if (wtTaxableCompensationIncome < 0)
		{
			wtTotalTaxWithheld=0;
			return wtTotalTaxWithheld;
		}
}

function addCommas(nStr)
{
	nStr += '';
	x = nStr.split('.');
	x1 = x[0];
	x2 = x.length > 1 ? '.' + x[1] : '';
	var rgx = /(\d+)(\d{3})/;
	while (rgx.test(x1)) {
		x1 = x1.replace(rgx, '$1' + ',' + '$2');
	}
	return x1 + x2;
}

/* this function computes and displays the totals of 
 * Gross Compensation Income, Total Non-Taxable and Taxable Compensation Income*/
function calculate()
{
	// Here we get the values of Gross Compensation Income, Total Non-Taxable and 
	// Taxable Compensation Income by calling our function
	// Each function returns a number so by calling them we add the values they return together
	var totalCompensationIncome = parseFloat(getGrossCompensationIncome());
	var totalNonTaxable = parseFloat(getTotalNonTaxableNt());
	//var totalTaxableCompensationIncome = parseFloat(getTaxableCompensationIncome() + getSssGsisPagibigNt());
	//var totalAdditionalExemptions = parseFloat(getPersonalAdditionalExemptions());
	//var totalExempt = parseFloat(getTotalExemptions());
	//var netTaxableIncome = parseFloat(getNetTaxableCompensationIncome());
	//var netTaxableIncome = parseFloat(getTaxableCompensationIncome() + getSssGsisPagibigNt());
	var netTaxableIncome = parseFloat(getNetTaxableCompensationIncome());
	
	
	// This will display the values	of Gross Compensation Income, Total Non-Taxable and 
	// Taxable Compensation Income on our form
	//document.getElementById('grossCompensationIncome').value = parseFloat(Math.round(totalCompensationIncome * 100) / 100).toFixed(2).toLocaleString();
	document.getElementById('grossCompensationIncome').value = addCommas(parseFloat(Math.round(totalCompensationIncome * 100) / 100).toFixed(2));
	document.getElementById('totalNonTaxableNt').value = addCommas(parseFloat(Math.round(totalNonTaxable * 100) / 100).toFixed(2));
	//document.getElementById('taxableCompensationIncome').value = addCommas(parseFloat(Math.round(totalTaxableCompensationIncome * 100) / 100).toFixed(2));
	//document.getElementById('personalAdditionalExemptions').value = addCommas(parseFloat(Math.round(totalAdditionalExemptions * 100) / 100).toFixed(2));
	//document.getElementById('totalExemptions').value = addCommas(parseFloat(Math.round(totalExempt * 100) / 100).toFixed(2));
	document.getElementById('netIncome').value = addCommas(parseFloat(Math.round(netTaxableIncome * 100) / 100).toFixed(2));	
}

//main function to calculate taxable compensation income and withholding tax
function calculateForm()
{
	var dailyZero = parseFloat(getDailyZero());
	var weeklyZero = parseFloat(getWeeklyZero());
	var semiMonthlyZero = parseFloat(getSemiMonthlyZero());
	var monthlyZero = parseFloat(getMonthlyZero());
	var annual = parseFloat(getAnnual());
	var withholdingTax;
	
	
	if (document.getElementById("payroll_period").value=='daily')
	{
		withholdingTax = dailyZero;
		alert("Computation Successful!");
		document.getElementById('totalWithholdingTax').value = addCommas(parseFloat(Math.round(withholdingTax * 100) / 100).toFixed(2));	
	} //start of weekly
	else if (document.getElementById("payroll_period").value=='weekly')
	{
		withholdingTax = weeklyZero;
		alert("Computation Successful!");
		document.getElementById('totalWithholdingTax').value = addCommas(parseFloat(Math.round(withholdingTax * 100) / 100).toFixed(2));	
	} //start of semi-monthly
	else if (document.getElementById("payroll_period").value=='semi_monthly')
	{
		withholdingTax = semiMonthlyZero;
		alert("Computation Successful!");
		document.getElementById('totalWithholdingTax').value = addCommas(parseFloat(Math.round(withholdingTax * 100) / 100).toFixed(2));	
	} // start of monthly
	else if (document.getElementById("payroll_period").value=='monthly')
	{
		withholdingTax = monthlyZero;
		alert("Computation Successful!");
		document.getElementById('totalWithholdingTax').value = addCommas(parseFloat(Math.round(withholdingTax * 100) / 100).toFixed(2));	
	} // start of annual
	else if (document.getElementById("payroll_period").value=='annual')
	{
		withholdingTax = annual;
		alert("Computation Successful!");
		document.getElementById('totalWithholdingTax').value = addCommas(parseFloat(Math.round(withholdingTax * 100) / 100).toFixed(2));	
	}
	
}

//function to enable qualified dependents if personal exemption is not zero exemption.
function makeEnableAnnualFields()
{
	if (getPayrollPeriod() < 4)
	{ 
	document.withholding_tax_calculator.totalExemptions.disabled=false;
	document.withholding_tax_calculator.paidInsurance.disabled=false;
	} else 
	{
		document.withholding_tax_calculator.totalExemptions.disabled=true;
		document.withholding_tax_calculator.paidInsurance.disabled=true;
	}
	calculate();
}

function clearForm()
{
	document.forms["withholding_tax_calculator"].reset();
	//document.withholding_tax_calculator.totalExemptions.disabled=true;
	//document.withholding_tax_calculator.personalAdditionalExemptions.disabled=true;
	//document.withholding_tax_calculator.paidInsurance.disabled=true;
}

// function to allow enter to move to next input field
function tabE(obj, e)
{
	var e = (typeof event != 'undefined')?window.event:e;
	if (e.keyCode == 13)
	{
		var ele = document.forms[0].elements;
		for(var i=0; i<ele.length; i++)
		{
			var q = (i==ele.length-1)?0:i+1;
			if(obj==ele[i])
			{
				ele[q].focus();
				break
			}
		}
	return false;
	}
}


//function to allow only numeric values
function allowNumericOnly(objEvent)
{
 var keyInput; 		 
 keyInput = objEvent.charCode ? objEvent.charCode : objEvent.keyCode
 var keyInput = objEvent.keyCode || objEvent.which; 	 
 //Backspace=8,Delete = 46, Tab=9 & Navigation Keys
 if(keyInput!=8 && keyInput!=0 && keyInput!=46 && keyInput!=9 && keyInput!=44)
 {
	 if(!(keyInput>=48 && keyInput<=57))		 
		 return false;
 }
}

function insurancePopper()
{
	alert("Health and/or Hospitalization Insurance Premium of employees not exceeding P2,400/annum or P200/month whichever is lower and total family gross income does not exceed P250,000 for the calendar year.");
}

//function to add comma on values
function intFormat(n)
{
	var regex = /(\d)((\d{3},?)+)$/;
	n = n.split(',').join('');
	while (regex.test(n))
	{
		n = n.replace(regex, '$1,$2');
	}
	return n;
}

function numFormat(n)
{
	calculate();
	var pointReg = /([\d,\.]*)\.(\d*)$/, f;
	if(pointReg.test(n))
	{
		f = RegExp.$2;
		return intFormat(RegExp.$1) + '.' + f;
	}
	return intFormat(n);
}