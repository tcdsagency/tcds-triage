"""
MyCoverageInfo API Tool
=======================
Query mortgage payment & policy info from mycoverageinfo.com

Usage:
    python mci_api_tool.py <loan_number> <zip_code> <last_name>

Example:
    python mci_api_tool.py 0683026066 35215 Morse

Requirements:
    pip install requests
"""

import requests
import json
import base64
import sys


BASE_URL = "https://api.mycoverageinfo.com"
API_CLIENT_ID = "MCI2024Pr0d"
API_CLIENT_SECRET = "AllowG4t3way$Pr0d"


def get_gateway_token():
    print("[1/4] Authenticating...")
    resp = requests.post(
        f"{BASE_URL}/api/token/gettoken",
        json={"apiClientId": API_CLIENT_ID, "apiClientSecret": API_CLIENT_SECRET},
        timeout=15
    )
    resp.raise_for_status()
    data = resp.json()
    print(f"      Token obtained (expires: {data['expiration']})")
    return data["token"]


def search_loan(gateway_token, loan_number, zip_code, last_name):
    print(f"[2/4] Searching loan {loan_number}...")

    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": f"Bearer {gateway_token}",
        "Accept": "application/json, text/plain, */*",
        "RequestLevel-Default": "true"
    }

    payload = {
        "CaptchaResponse": "",
        "ClientAsgNumber": "",
        "ClientServicingSystem": "",
        "LoanNumber": loan_number,
        "Last4SSN": "",
        "SSN": "",
        "PropertyZip": zip_code,
        "LastName": last_name,
        "clientId": "",
        "version": "2",
        "IsAgentMode": True,
        "AlternateASGNumber": "",
        "sk": "bypass",
        "isPolicyMode": False,
        "ByPassOutage": False
    }

    resp = requests.post(f"{BASE_URL}/api/Loan/", json=payload, headers=headers, timeout=30)

    if resp.status_code == 200:
        data = resp.json()

        if isinstance(data, dict) and "error" in data:
            if "locked" in data["error"].lower():
                lock_info = data.get("lockInfo", {})
                mins = lock_info.get("remainingMinutes", "?")
                print(f"      Account locked. Remaining: {mins} minutes")
                return None
            else:
                print(f"      Error: {data['error']}")
                return None

        if isinstance(data, str) and data.startswith("Error"):
            print(f"      Error: {data}")
            return None

        print(f"      Loan found!")
        return data

    else:
        print(f"      Error ({resp.status_code}): {resp.text[:200]}")
        return None


def decode_jwt(token):
    parts = token.split(".")
    payload_b64 = parts[1] + "=" * (4 - len(parts[1]) % 4)
    return json.loads(base64.b64decode(payload_b64))


def extract_loan_info(loan_data):
    info = {}

    if isinstance(loan_data, dict):
        if "token" in loan_data:
            info["session_token"] = loan_data["token"]
            claims = decode_jwt(loan_data["token"])
            info["user_id"] = claims.get("sub", "")

        resp = loan_data.get("response", loan_data)
        if isinstance(resp, dict):
            info["asg_number"] = resp.get("asgNumber", "")
            info["user_id_resp"] = resp.get("userId", "")
            info["loan_number"] = resp.get("loanNumber", "")
            info["name"] = resp.get("name", "")
            info["first_name"] = resp.get("firstName", "")
            info["last_name"] = resp.get("lastName", "")
            info["email"] = resp.get("email", "")
            info["mobile_phone"] = resp.get("mobilePhone", "")
            info["home_phone"] = resp.get("homePhone", "")
            info["property_zip"] = resp.get("propertyZip", "")

            policies = resp.get("policies", [])
            if policies:
                info["policies"] = policies

            client = resp.get("clientInfo", {})
            if client:
                info["client_info"] = client

    return info


def get_payment_details(session_token, asg_number, user_id, policy_number,
                         policy_type_id="24", carrier_id="548",
                         policy_guid="", payment_guid="",
                         effective_date="", premium_amount=""):
    print(f"[3/4] Getting payment details for policy {policy_number}...")

    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": f"Bearer {session_token}",
        "Accept": "application/json, text/plain, */*"
    }

    url = (f"{BASE_URL}/api/history/payments/detail/"
           f"{asg_number}/{user_id}/{policy_number}/"
           f"{policy_type_id}/{carrier_id}/{policy_guid}/{payment_guid}"
           f"?effectiveDate={effective_date}&premiumAmount={premium_amount}")

    resp = requests.get(url, headers=headers, timeout=15)

    if resp.status_code == 200:
        data = resp.json()
        print(f"      Payment data retrieved!")
        return data
    else:
        print(f"      Error ({resp.status_code}): {resp.text[:200]}")
        return None


def get_document_status(session_token, asg_number, user_id):
    print(f"[4/4] Getting document status...")

    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": f"Bearer {session_token}",
        "Accept": "application/json, text/plain, */*"
    }

    url = f"{BASE_URL}/api/document/getstatus/{asg_number}/{user_id}/null/"
    resp = requests.get(url, headers=headers, timeout=15)

    if resp.status_code == 200 and resp.text:
        return resp.json()
    elif resp.status_code == 204:
        print(f"      No documents found.")
        return []
    else:
        print(f"      Error ({resp.status_code}): {resp.text[:200]}")
        return None


def format_results(loan_data, loan_info, payment_data, doc_data):
    print("\n" + "=" * 70)
    print("  MORTGAGE PAYMENT & POLICY INFORMATION")
    print("=" * 70)

    resp = loan_data.get("response", loan_data) if isinstance(loan_data, dict) else {}

    print("\n--- BORROWER ---")
    print(f"  Name:            {resp.get('name', 'N/A')}")
    print(f"  First Name:      {resp.get('firstName', 'N/A')}")
    print(f"  Last Name:       {resp.get('lastName', 'N/A')}")
    print(f"  Loan Number:     {resp.get('loanNumber', resp.get('maskedLoanNumber', 'N/A'))}")
    print(f"  Property ZIP:    {resp.get('propertyZip', 'N/A')}")
    print(f"  Email:           {resp.get('email', 'N/A')}")
    print(f"  Mobile Phone:    {resp.get('mobilePhone', 'N/A')}")
    print(f"  Home Phone:      {resp.get('homePhone', 'N/A')}")

    client = resp.get("clientInfo", {})
    if client:
        print("\n--- LENDER / MORTGAGEE ---")
        print(f"  Client Name:     {client.get('clientName', 'N/A')}")
        print(f"  Address:         {client.get('clientAddress', 'N/A')}")
        print(f"  City/State/ZIP:  {client.get('clientCity', '')}, {client.get('clientState', '')} {client.get('clientZip', '')}")

    policies = resp.get("policies", [])
    if policies:
        for i, pol in enumerate(policies):
            print(f"\n--- POLICY {i+1} ---")
            print(f"  Policy Number:   {pol.get('policyNumber', 'N/A')}")
            print(f"  Carrier:         {pol.get('carrier', 'N/A')}")
            print(f"  Type:            {pol.get('type', 'N/A')}")
            print(f"  Status:          {pol.get('status', 'N/A')}")
            print(f"  Effective Date:  {pol.get('effectiveDate', 'N/A')}")
            print(f"  Expiration Date: {pol.get('expirationDate', 'N/A')}")
            print(f"  Premium:         ${pol.get('premiumAmount', 'N/A')}")
            print(f"  Coverage:        ${pol.get('coverageAmount', 'N/A')}")
            print(f"  Deductible:      ${pol.get('deductibleAmount', 'N/A')}")

    if payment_data:
        for i, pay in enumerate(payment_data):
            print(f"\n--- PAYMENT {i+1} ---")
            print(f"  Carrier:         {pay.get('carrier', 'N/A')}")
            print(f"  Premium Amount:  ${pay.get('premiumAmount', 'N/A')}")
            print(f"  Payment Date:    {pay.get('paymentDate', 'N/A')}")
            print(f"  Payment Status:  {pay.get('paymentStatus', 'N/A')}")
            print(f"  Payment Address: {pay.get('paymentAddress', '')}")
            print(f"  Payment City:    {pay.get('paymentCity', '')}, {pay.get('paymentState', '')} {pay.get('paymentZip', '')}")
            print(f"  Next Payment:    {pay.get('nextPaymentDate', 'N/A')}")
            print(f"  Is Escrow:       {pay.get('isEscrow', 'N/A')}")
            print(f"  ASG Number:      {pay.get('asgNumber', 'N/A')}")

    if doc_data:
        for i, doc in enumerate(doc_data):
            print(f"\n--- DOCUMENT {i+1} ---")
            print(f"  Submitted:       {doc.get('submittedDate', 'N/A')}")
            print(f"  Completed:       {doc.get('completedDate', 'N/A')}")
            print(f"  Status:          {doc.get('documentStatus', 'N/A')}")
            print(f"  Policy Number:   {doc.get('policyNumber', 'N/A')}")

    print("\n" + "=" * 70)


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        print("ERROR: Please provide loan_number, zip_code, and last_name")
        print(f"\nUsage: python {sys.argv[0]} <loan_number> <zip_code> <last_name>")
        sys.exit(1)

    loan_number = sys.argv[1]
    zip_code = sys.argv[2]
    last_name = sys.argv[3]

    print(f"\nMyCoverageInfo API Tool")
    print(f"Loan: {loan_number} | ZIP: {zip_code} | Name: {last_name}\n")

    gateway_token = get_gateway_token()

    loan_data = search_loan(gateway_token, loan_number, zip_code, last_name)
    if not loan_data:
        print("\nLoan search failed. Exiting.")
        sys.exit(1)

    with open("loan_response_raw.json", "w") as f:
        json.dump(loan_data, f, indent=2)
    print(f"      Raw response saved to loan_response_raw.json")

    loan_info = extract_loan_info(loan_data)
    session_token = loan_info.get("session_token", "")
    asg_number = loan_info.get("asg_number", "")
    user_id = loan_info.get("user_id_resp", loan_info.get("user_id", ""))

    if not session_token:
        print("\nNo session token in response.")
        print(json.dumps(loan_data, indent=2))
        sys.exit(0)

    payment_data = None
    policies = loan_data.get("response", {}).get("policies", [])
    if policies:
        pol = policies[0]
        payment_data = get_payment_details(
            session_token=session_token,
            asg_number=asg_number,
            user_id=user_id,
            policy_number=pol.get("policyNumber", ""),
            policy_type_id=str(pol.get("policyTypeId", "24")),
            carrier_id=str(pol.get("carrierId", "548")),
            policy_guid=pol.get("policyGuid", ""),
            payment_guid=pol.get("paymentGuid", ""),
            effective_date=pol.get("effectiveDate", ""),
            premium_amount=str(pol.get("premiumAmount", ""))
        )

    doc_data = get_document_status(session_token, asg_number, user_id)

    format_results(loan_data, loan_info, payment_data, doc_data)

    all_results = {
        "loan_data": loan_data,
        "loan_info": loan_info,
        "payment_data": payment_data,
        "document_data": doc_data
    }
    with open("mci_full_results.json", "w") as f:
        json.dump(all_results, f, indent=2, default=str)
    print(f"\nFull results saved to mci_full_results.json")


if __name__ == "__main__":
    main()
