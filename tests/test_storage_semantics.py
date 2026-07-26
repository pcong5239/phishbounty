import pytest
from genlayer import DynArray, TreeMap


def test_dynarray_rejects_constructor_arguments():
    with pytest.raises(TypeError, match=r"DynArray\.__init__"):
        DynArray([1, 2])


def test_treemap_converts_plain_list_and_preserves_append_semantics():
    storage = TreeMap()
    storage["ids"] = [1, 2]

    assert isinstance(storage["ids"], DynArray)
    assert list(storage["ids"]) == [1, 2]

    storage["ids"].append(3)
    assert list(storage["ids"]) == [1, 2, 3]


def test_register_brand_domains_round_trip_with_storage_conversion(registry):
    brand_id = registry.register_brand(
        "Brand Acme",
        "acme.com,login.acme.com",
        "Customer login surfaces",
    )

    brand = registry.get_brand(brand_id)
    assert brand["domains"] == ["acme.com", "login.acme.com"]
