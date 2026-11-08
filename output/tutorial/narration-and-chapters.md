# DisputeGuard walkthrough

Conversational assistant: local model used. Bounded investigation: local model used. Recorded case-summary error: the model says $275.00, while the source payment is R2,750.00. The analyst must verify source amounts.

## 00:00 - Start with the right role

Welcome to DisputeGuard, a showcase for managing card payment disputes. This walkthrough follows a sample missing order from the customer statement through evidence, AI assistance and human review. Sign in with a showcase persona, or use a registered account. Customers see their own records; analysts review cases; administrators manage access and monitoring. The payments are sample records, with no bank connection or movement of money.

## 00:25 - Understand your dashboard

The dashboard gives you a quick view of the records available to your role. Use the totals and recent activity to understand your workload, then move through the sidebar to the statement, transactions or disputes. The same console adapts to each role. A customer sees a personal view, while staff can review the wider portfolio. Use the named sections to follow one payment all the way through its case.

## 00:49 - Check a payment

Open Bank statement and select Check for possible disputes. The application checks configured patterns such as large payments, unusual amounts and possible duplicates. These are explainable review flags, produced by rules. They do not establish fraud and do not automatically create a case. Compare the payment with your own records. You can still raise a concern even when no rule flags it. Search by merchant or payment number to narrow the list.

## 01:17 - Explain what went wrong

For this tutorial, we added a clearly labelled sample order worth two thousand seven hundred and fifty rand. Choose Review payment, describe what went wrong, then select Submit dispute. The example explains that an order did not arrive. The server checks who owns the payment and prevents duplicate active disputes. The concern becomes a submitted case that can be tracked in Disputes. Creating a case does not reverse the payment.

## 01:43 - Provide supporting evidence

In the case workspace, attach supporting evidence such as a receipt, order confirmation or merchant correspondence. This recording uploads a fictional receipt. The interface accepts PDF, PNG and JPEG files up to five megabytes each. Files are format checked and linked to the case; malware scanning is not configured. Download file lets an authorised user retrieve the attachment. Evidence remains supporting material for a person to assess.

## 02:11 - Ask a question in plain language

Ask assistant is the conversational AI feature. Select the investigation scope, then ask about a payment or case. Here we ask what happened to the sample order and what evidence to provide. The server gathers only records visible to the signed in user, checks case progress and evidence metadata, and asks the local Ollama model for an explanation. The answer label identifies a local model response or a rules based response. The assistant cannot approve cases or move money.

## 02:39 - Move into analyst review

Switch to the analyst persona, Nomsa Mahlangu, and open the same case from the queue. The workspace shows the current state, version, advisory risk, reason code, required evidence and deadline information. Choose begin review, followed by begin investigation when the available evidence supports that step. Available actions depend on both the user role and the current state. Each update is checked by the server, including the case version to prevent conflicting edits.

## 03:08 - Watch the bounded AI loop

Run bounded investigation is a separate AI workflow inside the case. The application assembles the transaction, evidence metadata and advisory risk signals. Ollama proposes a read only step or a stop. Application code validates proposals against three allowed tool names and enforces a default limit of three iterations and three tool calls. The visible history records observations and the stopping outcome. Context is supplied up front, without database browsing or document reading. In this recording, the model misstates the amount and currency. The source payment is two thousand seven hundred and fifty rand. Verify the original record.

## 03:47 - Keep the decision human

An AI summary is advisory. An authorised analyst or administrator must assess the evidence and choose the case outcome. This demonstration approves the tutorial case after review; that changes the case state only. No refund or money transfer takes place. Download case report creates a branded PDF containing case information and available evidence attachments. Keep the report with your review record and compare the outcome with the audit history.

## 04:13 - Revisit investigation records

The Investigations section lists saved investigation records with their source, summary and activity counts. Use it to revisit what the assistant produced rather than treating a single answer as a final decision. A local model label means a model supplied valid output during that run. A fallback label means deterministic behaviour was used. Model availability and response quality can change, so always read the recorded outcome and return to the underlying case evidence.

## 04:41 - Check the audit trail

The Audit log records dispute lifecycle events in order, including the actor and state changes. The application uses a SHA two hundred and fifty six hash chain to make changes to the recorded sequence detectable through verification. This helps explain how the case reached its current state. It is an integrity check on the stored log, not proof that every business decision was correct. Compare the final outcome with the case timeline and exported report.

## 05:07 - Follow progress and updates

Return to the customer view and open Notifications. Case and evidence activity appear in the inbox, where you can open the associated record and mark updates as read. Email preferences are separate. The interface shows whether email is in preview mode or SMTP delivery mode. Preview emails remain inside the application; SMTP mode can send to the saved address when enabled. No email is sent as part of this walkthrough.

## 05:33 - Monitor the sample portfolio

As administrator Mandla Ndlovu, open Monitoring. Scan once checks the sample portfolio immediately. Administrators can also start recurring monitoring and choose the interval and large payment threshold. Monitoring runs in the server process and pauses when the server is offline. Flags notify customers and staff for review, without automatically creating a case or deciding a payment outcome. These monitoring checks are deterministic rules, separate from the language model assistant.

## 06:02 - Manage people and permissions

People and access is the administrator workspace for customers, staff invitations and sample payment entry. New registered customers begin with an empty statement; an administrator can add showcase payments for the appropriate owner. Invitations provide the account acceptance journey. Use the correct role for each person because it controls what they can see and do. This recording only inspects the page and does not send invitations or change anyone else’s access.

## 06:28 - Make the console yours

The console supports light and dark themes, English, isiZulu and Afrikaans navigation, plus a command palette for quick access. The recording finishes in the light theme. To repeat the tutorial, start with the customer statement, open a concern, attach evidence, ask the assistant and move to staff review. The essential pattern stays the same: scoped records, explainable assistance, server checked actions and a human decision supported by an audit trail.