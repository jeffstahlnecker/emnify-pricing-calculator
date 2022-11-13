import { useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import {
  CheckIcon,
  ChevronUpDownIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/20/solid";
import { Combobox, Switch } from "@headlessui/react";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export const loader = async () => {
  const getSortedTariffsPlus = async (currencyId) => {
    let sortedTariffs = [];
    await fetch("https://cdn.emnify.net/api/v1/public/tariff")
      .then((response) => response.json())
      .then((data) => {
        for (let i = 0; i < data.length; i++) {
          if (data[i].currency.id === currencyId && data[i].status.id == 1) {
            sortedTariffs.push(data[i]);
          }
        }
      });

    return sortedTariffs;
  };

  const getSortedPlans = async (currencyId) => {
    let sortedPlans = [];
    await fetch("https://cdn.emnify.net/api/v1/public/tariff_plan")
      .then((response) => response.json())
      .then((data) => {
        for (let i = 0; i < data.length; i++) {
          if (data[i].currency.id === currencyId && data[i].status.id == 1) {
            sortedPlans.push(data[i]);
          }
        }
      });
    return sortedPlans;
  };

  const eurRatTariff = await getSortedTariffsPlus(1);
  const usdRatTariff = await getSortedTariffsPlus(2);

  const getRateTariff = async (tariffs) => {
    let ratezones = [];
    const setTariffs = tariffs;
    for (let i = 0; i < tariffs.length; i++) {
      await fetch(
        `https://cdn.emnify.net/api/v1/public/tariff/${tariffs[i].id}/ratezone`
      )
        .then((response) => response.json())
        .then((data) => {
          setTariffs[i].ratezones = data;
          for (let j = 0; j < data.length; j++) {
            if (data[j].main_zone === true) {
              ratezones.push(data[j]);
            }
          }
        });
    }
    return { tariffs: setTariffs, ratezones: ratezones };
  };

  const updatedRatezones = [
    (await getRateTariff(eurRatTariff)).ratezones,
    (await getRateTariff(usdRatTariff)).ratezones,
  ];

  const getAllAvailableCountries = async (ratezonesObjectArray) => {
    let countries = [];
    ratezonesObjectArray.map((currency) => {
      return currency.map((ratezone) => {
        return ratezone.coverage.map((provider) => {
          const formatCountries = {
            id: provider.country.id,
            name: provider.country.name,
          };
          countries.push(formatCountries);
        });
      });
    });
    const uniqueCountries = Array.from(new Set(countries.map((a) => a.id))).map(
      (id) => {
        return countries.find((a) => a.id === id);
      }
    );
    uniqueCountries.sort((a, b) =>
      a.name > b.name ? 1 : b.name > a.name ? -1 : 0
    );

    return uniqueCountries;
  };

  const availableCountries = await getAllAvailableCountries(updatedRatezones);

  const pricingData = {
    countries: availableCountries,
    usd: { tariffs: usdRatTariff, plans: await getSortedPlans(2) },
    eur: { tariffs: eurRatTariff, plans: await getSortedPlans(1) },
  };

  return pricingData;
};

export default function Index() {
  const pricing = useLoaderData();
  const { countries } = pricing;
  const [query, setQuery] = useState("");
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState(1);
  const [enabled, setEnabled] = useState(false);
  const [deviceCount, setDeviceCount] = useState(1);
  const [pricePerActive, setPricePerActive] = useState();
  const [usagePerDevice, setUsagePerDevice] = useState(1);
  const [inclusiveVolume, setInclusiveVolume] = useState({
    id: 0,
    volume: 0,
    cost: 0,
    excessTraffic: 0,
    message: "",
  });
  const [calculatedPricing, setCalculatedPricing] = useState({
    data: 0,
    smsMo: 0,
  });

  const tariff =
    selectedCurrency === 1 ? pricing.eur.tariffs : pricing.usd.tariffs;

  const plan = selectedCurrency === 1 ? pricing.eur.plans : pricing.eur.plans;

  const getPricing = (countries) => {
    const collectedData = [];
    tariff.forEach((tariff) => {
      const tariffId = tariff.id;
      const { ratezones } = tariff;
      ratezones.forEach((ratezone) => {
        const inclusiveVolume = ratezone?.inclusive_volume;
        const ratezoneId = ratezone.id;

        let dataRate = null;
        let smsmoRate = null;
        ratezone.rate.forEach((rate) => {
          if (rate.service.id === 38) {
            dataRate = rate.rate;
          } else {
            smsmoRate = rate.rate;
          }
        });

        const { coverage } = ratezone;
        coverage.forEach((provider) => {
          const { country } = provider;

          for (let i = 0; i < countries.length; i++) {
            if (country.id === countries[i].id) {
              collectedData.push({
                country: countries[i],
                tariff: tariffId,
                ratezone: ratezoneId,
                data: dataRate,
                smsMo: smsmoRate,
                inclusiveVolume: inclusiveVolume,
              });
            }
          }
        });
      });
    });

    const organized = {};

    // organize values under ratezones
    for (let i = 0; i < collectedData.length; i++) {
      organized[collectedData[i].ratezone] = {
        countries: [],
        tariff: collectedData[i].tariff,
      };
    }
    for (let i = 0; i < collectedData.length; i++) {
      if (
        !organized[collectedData[i].ratezone].countries.includes(
          collectedData[i].country
        )
      ) {
        organized[collectedData[i].ratezone].countries.push(
          collectedData[i].country
        );
      }
    }

    // create array of ratezones that only have all countries

    let reducedArray = [600];

    for (let i = 0; i < collectedData.length; i++) {
      if (
        organized[collectedData[i].ratezone].countries.length ===
        countries.length
      ) {
        reducedArray.push(collectedData[i]);
      }
    }

    // find the zone with lowest price for each country

    const check = reducedArray.reduce(function (prev, curr) {
      return prev.Cost < curr.Cost ? prev : curr;
    });

    let pricing = {
      data: check.data,
      smsMo: check.smsMo,
      tariff: check.tariff,
      ratezone: check.ratezone,
      inclusiveVolume: check.inclusiveVolume,
    };
    return pricing;
  };

  const addCountryHandler = (countryObject) => {
    if (selectedCountries.includes(countryObject)) {
      return;
    }
    const currentSelectedCountries = [...selectedCountries];
    currentSelectedCountries.push(countryObject);
    setSelectedCountries(currentSelectedCountries);
  };

  const removeCountryHandler = (countryObject) => {
    if (!selectedCountries.includes(countryObject)) {
      return;
    }
    const currentSelectedCountries = [...selectedCountries];
    const indexOfObject = currentSelectedCountries.indexOf(countryObject);
    if (indexOfObject > -1) {
      currentSelectedCountries.splice(indexOfObject, 1);
      setSelectedCountries(currentSelectedCountries);
    }
  };

  const getPerActiveSimPrice = (count) => {
    let thePlan = [];
    for (let i = 0; i < plan.length; i++) {
      if (plan[i].id === 327 || plan[i].id === 328) {
        thePlan = plan[i].price.sim_activated_rate;
      }
    }
    let price;

    for (let i = 0; i < thePlan.length; i++) {
      if (
        count >= thePlan[i].scale_start &&
        count < thePlan[i + 1].scale_start
      ) {
        price = thePlan[i].rate;
      }
    }

    return price;
  };

  const getInclusiveVolume = (pricing) => {
    let result = {
      id: 0,
      volume: 0,
      cost: 0,
      excessTraffic: 0,
      message: "",
    };
    if (pricing.inclusiveVolume === undefined) {
      result = {
        id: 0,
        volume: 0,
        cost: 0,
        excessTraffic: 0,
        message: "This country combination requires a custom quote",
      };
      return result;
    }
    const { inclusiveVolume } = pricing;

    for (let i = 0; i < inclusiveVolume.length; i++) {
      if (
        usagePerDevice >= inclusiveVolume[i].volume &&
        usagePerDevice < inclusiveVolume[i + 1].volume
      ) {
        result = {
          id: inclusiveVolume[i].id,
          volume: inclusiveVolume[i].volume,
          cost: inclusiveVolume[i].cost,
          excessTraffic: inclusiveVolume[i].excess_traffic,
          message: "",
        };
      }
    }
    return result;
  };

  useEffect(() => {
    setInclusiveVolume(getInclusiveVolume(calculatedPricing));
  }, [calculatedPricing]);

  const filteredCountries =
    query === ""
      ? countries
      : countries.filter((country) => {
          return country.name.toLowerCase().includes(query.toLowerCase());
        });

  return (
    <div className="w-screen bg-edbackground">
      <div className="w-screen h-screen px-4 pt-10 mx-auto bg-transparent max-w-7xl sm:px-6 lg:px-10">
        <div className="grid grid-cols-12 mx-auto max-w-7xl gap-x-2">
          <div className="col-span-6 overflow-hidden rounded-lg shadow bg-ewbackground ">
            <div className="px-4 py-5 sm:p-6">
              <Switch
                checked={enabled}
                onChange={(e) => {
                  setEnabled(e);
                  enabled ? setSelectedCurrency(1) : setSelectedCurrency(2);
                }}
                className={classNames(
                  enabled ? "bg-edbackground" : "bg-gray-200",
                  "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                )}
              >
                <span className="sr-only">Use setting</span>
                <span
                  className={classNames(
                    enabled ? "translate-x-5" : "translate-x-0",
                    "pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-ewbackground shadow ring-0 transition duration-200 ease-in-out"
                  )}
                >
                  <span
                    className={classNames(
                      enabled
                        ? "opacity-0 ease-out duration-100"
                        : "opacity-100 ease-in duration-200",
                      "absolute inset-0 flex h-full w-full items-center justify-center transition-opacity"
                    )}
                    aria-hidden="true"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-6 h-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                  <span
                    className={classNames(
                      enabled
                        ? "opacity-100 ease-in duration-200"
                        : "opacity-0 ease-out duration-100",
                      "absolute inset-0 flex h-full w-full items-center justify-center transition-opacity"
                    )}
                    aria-hidden="true"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-6 h-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.25 7.756a4.5 4.5 0 100 8.488M7.5 10.5h5.25m-5.25 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                </span>
              </Switch>

              <Combobox
                as="div"
                value={selectedCountries.map((country) => {
                  return <p key={country?.id}>{country?.name}</p>;
                })}
                onChange={(e) => {
                  addCountryHandler(e);
                }}
              >
                <Combobox.Label className="block text-sm font-medium text-gray-700">
                  Each device will travel to these countries when in use:
                </Combobox.Label>
                <div className="relative mt-1">
                  <Combobox.Input
                    className="w-full py-2 pl-3 pr-10 bg-white border border-gray-300 rounded-md shadow-sm focus:border-edbackground focus:outline-none focus:ring-1 focus:ring-edbackground sm:text-sm"
                    onChange={(event) => setQuery(event.target.value)}
                    displayValue={(country) => country?.name}
                  />
                  <Combobox.Button className="absolute inset-y-0 right-0 flex items-center px-2 rounded-r-md focus:outline-none">
                    <ChevronUpDownIcon
                      className="w-5 h-5 text-gray-400"
                      aria-hidden="true"
                    />
                  </Combobox.Button>

                  {filteredCountries.length > 0 && (
                    <Combobox.Options className="absolute z-10 w-full py-1 mt-1 overflow-auto text-base rounded-md shadow-lg bg-edtext max-h-60 ring-1 ring-edbackground ring-opacity-5 focus:outline-none sm:text-sm">
                      {filteredCountries.map((country) => (
                        <Combobox.Option
                          key={country.id}
                          value={country}
                          className={({ active }) =>
                            classNames(
                              "relative cursor-default select-none py-2 pl-8 pr-4",
                              active
                                ? "bg-edbackground text-ewbackground"
                                : "text-gray-900"
                            )
                          }
                        >
                          {({ active, selected }) => (
                            <>
                              <span
                                className={classNames(
                                  "block truncate",
                                  selected && "font-semibold"
                                )}
                              >
                                {country.name}
                              </span>

                              {selected && (
                                <span
                                  className={classNames(
                                    "absolute inset-y-0 left-0 flex items-center pl-1.5",
                                    active ? "text-edtext" : "text-edspark-10"
                                  )}
                                >
                                  <CheckIcon
                                    className="w-5 h-5"
                                    aria-hidden="true"
                                  />
                                </span>
                              )}
                            </>
                          )}
                        </Combobox.Option>
                      ))}
                    </Combobox.Options>
                  )}
                </div>
              </Combobox>
              <div>
                {selectedCountries.map((country) => {
                  return (
                    <span
                      key={country.name}
                      className="mt-2 inline-flex items-center rounded-full bg-ewbackground py-0.5 pl-2.5 pr-1 text-sm font-medium text-ewtext"
                    >
                      {country.name}
                      <button
                        type="button"
                        className="ml-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-ewtext hover:bg-indigo-200 hover:text-ewbackground focus:bg-ewbackground focus:text-edtext focus:outline-none"
                        onClick={() => {
                          removeCountryHandler(country);
                        }}
                      >
                        <span className="sr-only">Remove large option</span>
                        <svg
                          className="w-2 h-2"
                          stroke="currentColor"
                          fill="none"
                          viewBox="0 0 8 8"
                        >
                          <path
                            strokeLinecap="round"
                            strokeWidth="1.5"
                            d="M1 1l6 6m0-6L1 7"
                          />
                        </svg>
                      </button>
                    </span>
                  );
                })}
              </div>
              <br />
              <div className="flex gap-x-5">
                <div className="flex-1">
                  <label
                    htmlFor="device-count"
                    className="block text-sm font-medium text-gray-700"
                  >
                    How many devices?
                  </label>
                  <div className="relative mt-1 rounded-md shadow-sm">
                    <input
                      type="number"
                      name="device-count"
                      id="device-count"
                      className="block w-full pr-10 border-gray-300 rounded-md focus:border-ewtext focus:ring-ewtext sm:text-sm"
                      placeholder="1"
                      onChange={(e) => {
                        setDeviceCount(e.target.value < 1 ? 1 : e.target.value);
                      }}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <QuestionMarkCircleIcon
                        className="w-5 h-5 text-gray-400"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="device-usage"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Device usage per month (MB)?
                  </label>
                  <div className="relative mt-1 rounded-md shadow-sm">
                    <input
                      type="number"
                      name="device-usage"
                      id="device-usage"
                      className="block w-full pr-10 border-gray-300 rounded-md focus:border-ewtext focus:ring-ewtext sm:text-sm"
                      placeholder="1"
                      onChange={(e) => {
                        setUsagePerDevice(e.target.value);
                      }}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <QuestionMarkCircleIcon
                        className="w-5 h-5 text-gray-400"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <br />
              <div>
                <button
                  className="px-4 py-2 font-bold text-white rounded bg-edbackground hover:bg-ewspark-10"
                  onClick={() => {
                    setCalculatedPricing(getPricing(selectedCountries));
                    setPricePerActive(getPerActiveSimPrice(deviceCount));
                  }}
                >
                  Get Pricing
                </button>
              </div>
              <br />
            </div>
          </div>

          <div className="col-span-3 overflow-hidden rounded-lg shadow bg-ewbackground">
            <div className="px-4 py-5 sm:p-6">
              <div className="">
                <div className="text-lg font-bold col-span-full">
                  Pay as you go
                </div>
                <div className="text-xs font-medium text-gray-500 truncate col-span-full">
                  Data (per MB):
                </div>
                <div className="">
                  <div className="mt-1 text-3xl font-semibold tracking-tight text-edbackground">
                    {calculatedPricing.data === 0 ? "" : calculatedPricing.data}
                  </div>
                </div>
                <div className="">
                  <div className="text-xs font-medium text-gray-500 truncate">
                    Per Active SIM:
                  </div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight text-edbackground">
                    {pricePerActive}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-span-3 overflow-hidden rounded-lg shadow bg-ewbackground">
            <div className="px-4 py-5 sm:p-6">
              <div className="text-lg font-bold">Device Pool</div>
              <div className="text-xs font-medium text-gray-500 truncate col-span-full">
                Monthly Rate:
              </div>
              <div className="">
                <div className="mt-1 text-3xl font-semibold tracking-tight text-edbackground">
                  {inclusiveVolume.id === 0
                    ? ""
                    : inclusiveVolume.message === ""
                    ? inclusiveVolume.cost * deviceCount
                    : inclusiveVolume.message}
                </div>
              </div>
              <div className="">
                <div className="text-xs font-medium text-gray-500 truncate">
                  Overage:
                </div>
                <div className="mt-1 text-lg font-semibold tracking-tight text-edbackground">
                  {inclusiveVolume.id === 0
                    ? ""
                    : inclusiveVolume.message === ""
                    ? `If your devices use more than ${
                        inclusiveVolume.volume * deviceCount
                      } MB, then the overage fee is ${
                        inclusiveVolume.excessTraffic
                      } per MB`
                    : ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
