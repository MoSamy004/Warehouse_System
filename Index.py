import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime
import io

# إعدادات الصفحة
st.set_page_config(page_title="Warehouse Management System", layout="wide")

# --- 1. إدارة البيانات (Database Simulation) ---
# ملاحظة: في النسخة الاحترافية نستخدم Database، هنا نستخدم session_state للتجربة
if 'data_records' not in st.session_state:
    st.session_state.data_records = pd.DataFrame(columns=[
        'ID', 'Date', 'Truck_Number', 'Vessel', 'Weight', 'Task_Name', 'Warehouse_Name'
    ])

if 'warehouses' not in st.session_state:
    st.session_state.warehouses = {}  # {name: capacity}

if 'global_amount' not in st.session_state:
    st.session_state.global_amount = 0.0

if 'last_task' not in st.session_state:
    st.session_state.last_task = ""

# --- 2. الدالات المساعدة ---
def get_warehouse_usage(warehouse_name):
    df = st.session_state.data_records
    return df[df['Warehouse_Name'] == warehouse_name]['Weight'].sum()

# --- 3. الجانب الجانبي (Sidebar) - الإعدادات ---
st.sidebar.header("⚙️ Settings")

# إدخال الكمية الكبيرة الكلية
new_global = st.sidebar.number_input("Set Global Total Amount", value=st.session_state.global_amount)
if new_global != st.session_state.global_amount:
    st.session_state.global_amount = new_global

st.sidebar.divider()

# إضافة مخزن جديد
st.sidebar.subheader("🏗️ Add/Edit Warehouse")
with st.sidebar.form("add_warehouse_form"):
    w_name = st.text_input("Warehouse Name")
    w_cap = st.number_input("Max Capacity (Weight)", min_value=1.0)
    submit_w = st.form_submit_button("Save Warehouse")
    if submit_w and w_name:
        st.session_state.warehouses[w_name] = w_cap
        st.success(f"Warehouse {w_name} updated!")

# --- 4. الواجهة الرئيسية - Dashboard ---
st.title("📦 Smart Warehouse System")

# عرض الكمية الكبيرة المتبقية
total_used = st.session_state.data_records['Weight'].sum()
remaining_global = st.session_state.global_amount - total_used

col1, col2 = st.columns(2)
col1.metric("Global Total Amount", f"{st.session_state.global_amount:,.2f}")
col2.metric("Remaining Global Amount", f"{remaining_global:,.2f}", delta_color="inverse")

st.divider()

# --- 5. الرسوم البيانية (Cylinders/Gauges) ---
if st.session_state.warehouses:
    st.subheader("📊 Warehouses Status")
    cols = st.columns(len(st.session_state.warehouses))
    for i, (name, cap) in enumerate(st.session_state.warehouses.items()):
        current_weight = get_warehouse_usage(name)
        percent = (current_weight / cap) * 100
        
        # تحديد اللون
        if percent < 60: color = "green"
        elif percent < 85: color = "orange"
        else: color = "red"
        
        fig = go.Figure(go.Indicator(
            mode = "gauge+number",
            value = current_weight,
            title = {'text': f"Warehouse: {name}"},
            gauge = {
                'axis': {'range': [None, cap]},
                'bar': {'color': color},
                'steps': [
                    {'range': [0, cap*0.6], 'color': "lightgray"},
                    {'range': [cap*0.6, cap*0.85], 'color': "gray"}
                ],
            }
        ))
        fig.update_layout(height=250, margin=dict(l=20, r=20, t=50, b=20))
        cols[i].plotly_chart(fig, use_container_width=True)

st.divider()

# --- 6. إدخال البيانات ---
st.subheader("📥 Data Entry")
with st.form("entry_form", clear_on_submit=False):
    c1, c2, c3 = st.columns(3)
    
    with c1:
        w_choice = st.selectbox("Select Warehouse", options=list(st.session_state.warehouses.keys()))
        task = st.text_input("Task Name", value=st.session_state.last_task)
    
    with c2:
        vessel = st.text_input("Vessel")
        truck = st.text_input("Truck Number")
    
    with c3:
        weight = st.number_input("Weight", min_value=0.0)
        date = st.date_input("Date", datetime.now())

    submit_entry = st.form_submit_button("Save Record")

    if submit_entry:
        if not w_choice:
            st.error("Please add a warehouse first!")
        else:
            new_id = len(st.session_state.data_records) + 1
            new_row = {
                'ID': new_id,
                'Date': date,
                'Truck_Number': truck,
                'Vessel': vessel,
                'Weight': weight,
                'Task_Name': task,
                'Warehouse_Name': w_choice
            }
            st.session_state.data_records = pd.concat([st.session_state.data_records, pd.DataFrame([new_row])], ignore_index=True)
            st.session_state.last_task = task # حفظ اسم التاسك للمرة القادمة
            st.success("Record saved successfully!")
            st.rerun()

# --- 7. عرض البيانات وتصدير إكسيل ---
st.divider()
st.subheader("📑 Records & Export")

if not st.session_state.data_records.empty:
    st.dataframe(st.session_state.data_records, use_container_width=True)
    
    # وظيفة تصدير الإكسيل (شيت لكل مخزن)
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='xlsxwriter') as writer:
        for w_name in st.session_state.warehouses.keys():
            df_sub = st.session_state.data_records[st.session_state.data_records['Warehouse_Name'] == w_name]
            if not df_sub.empty:
                df_sub.to_excel(writer, sheet_name=w_name, index=False)
    
    st.download_button(
        label="📥 Download All Data as Excel",
        data=buffer.getvalue(),
        file_name=f"Warehouse_Report_{datetime.now().strftime('%Y-%m-%d')}.xlsx",
        mime="application/vnd.ms-excel"
    )
else:
    st.info("No records found yet.")
